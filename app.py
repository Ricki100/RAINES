from flask import Flask, render_template, request, jsonify, send_file, url_for, after_this_request
from werkzeug.utils import secure_filename
from flask_cors import CORS
import os
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
import json
import io
import zipfile
from datetime import datetime
import tempfile
import shutil
from io import BytesIO
import requests
import glob # Import glob for file matching
import random
import string
import threading
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure upload folder and other settings
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SECRET_KEY'] = os.urandom(24)  # Generate a random secret key

# Ensure required directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(os.path.join('static', 'previews'), exist_ok=True)
os.makedirs(os.path.join('static', 'downloads'), exist_ok=True)
os.makedirs(os.path.join('static', 'fonts'), exist_ok=True)

# Font management
FONTS_DIR = os.path.join('static', 'fonts')
DEFAULT_FONT = os.path.join(FONTS_DIR, 'arial.ttf')

# Global variables to track progress
preview_progress = {"percent": 0, "status": "idle"}
download_progress = {"percent": 0, "status": "idle"}

# Ensure fonts directory exists
os.makedirs(FONTS_DIR, exist_ok=True)

def get_font_path(font_name, bold=False, italic=False):
    """Get the appropriate font file path based on name and style."""
    # Normalize font name for matching
    font_name = font_name.lower().replace(' ', '')
    
    # Map common font names to our available font files
    font_map = {
        'arial': {
            'regular': 'Arial.ttf',
            'bold': 'ArialBd.ttf',
            'italic': 'ArialIt.ttf',
            'bolditalic': 'ArialBdIt.ttf'
        },
        'timesnewroman': {
            'regular': 'TimesNewRoman.ttf',
            'bold': 'TimesNewRomanBd.ttf',
            'italic': 'TimesNewRomanIt.ttf',
            'bolditalic': 'TimesNewRomanBdIt.ttf'
        },
        'times': {  # Alias for Times New Roman
            'regular': 'TimesNewRoman.ttf',
            'bold': 'TimesNewRomanBd.ttf',
            'italic': 'TimesNewRomanIt.ttf',
            'bolditalic': 'TimesNewRomanBdIt.ttf'
        },
        'helvetica': {
            'regular': 'Helvetica.ttf',
            'bold': 'HelveticaBd.ttf',
            'italic': 'Helvetica.ttf',  # Use regular as fallback
            'bolditalic': 'HelveticaBd.ttf'  # Use bold as fallback
        },
        'helveticaneue': {
            'regular': 'HelveticaNeue.ttf',
            'bold': 'HelveticaNeueBd.ttf',
            'italic': 'HelveticaNeue.ttf',  # Use regular as fallback
            'bolditalic': 'HelveticaNeueBd.ttf'  # Use bold as fallback
        },
        'georgia': {
            'regular': 'Georgia.ttf',
            'bold': 'GeorgiaBd.ttf',
            'italic': 'GeorgiaIt.ttf',
            'bolditalic': 'GeorgiaBdIt.ttf'
        },
        'verdana': {
            'regular': 'Verdana.ttf',
            'bold': 'VerdanaBd.ttf',
            'italic': 'VerdanaIt.ttf',
            'bolditalic': 'VerdanaBdIt.ttf'
        },
        'couriernew': {
            'regular': 'CourierNew.ttf',
            'bold': 'CourierNew.ttf',  # Use regular as fallback
            'italic': 'CourierNew.ttf',  # Use regular as fallback
            'bolditalic': 'CourierNew.ttf'  # Use regular as fallback
        }
    }
    
    # Default to Arial if font not found
    if font_name not in font_map:
        font_name = 'arial'
    
    style = 'regular'
    if bold and italic:
        style = 'bolditalic'
    elif bold:
        style = 'bold'
    elif italic:
        style = 'italic'
    
    # Get the font file name
    font_file = font_map[font_name][style]
    font_path = os.path.join(FONTS_DIR, font_file)
    
    # If file doesn't exist, fall back to default Arial
    if not os.path.exists(font_path):
        print(f"Warning: Font file {font_path} not found, falling back to Arial")
        return os.path.join(FONTS_DIR, 'Arial.ttf')
    
    return font_path

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_template', methods=['POST'])
def upload_template():
    import sys
    is_vercel = 'VERCEL' in os.environ or sys.platform == 'linux'
    # Use /tmp for uploads on Vercel, else use static/uploads
    upload_folder = '/tmp' if is_vercel else app.config['UPLOAD_FOLDER']
    if 'template' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['template']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    original_filename = secure_filename(file.filename)
    extension = os.path.splitext(original_filename)[1]
    filename = f'current_template{extension}'
    filepath = os.path.join(upload_folder, filename)
    # Clear any existing template files
    for f in glob.glob(os.path.join(upload_folder, 'current_template.*')):
        try:
            os.remove(f)
        except Exception as e:
            print(f"Warning: Could not remove old template file {f}: {e}")
    try:
        file.save(filepath)
    except Exception as e:
        return jsonify({'error': f'Failed to save file: {str(e)}'}), 500
    # Return the URL for the uploaded image
    if is_vercel:
        image_url = url_for('serve_tmp_file', filename=filename, _external=True)
    else:
        image_url = url_for('static', filename=f'uploads/{filename}', _external=True)
    return jsonify({
        'filename': filename,
        'image_url': image_url,
        'message': 'Template uploaded successfully'
    })

@app.route('/upload_csv', methods=['POST'])
def upload_csv():
    if 'csv' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['csv']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Check file extension to determine if it's CSV or Excel
        if file.filename.lower().endswith('.csv'):
            # For CSV files, use encoding='utf-8-sig' to handle BOM and other encoding issues
            df = pd.read_csv(file, encoding='utf-8-sig', on_bad_lines='skip')
        elif file.filename.lower().endswith(('.xlsx', '.xls')):
            # For Excel files
            df = pd.read_excel(file)
        else:
            return jsonify({'error': 'Unsupported file format. Please upload a CSV or Excel file'}), 400
        
        preview_rows = min(20, len(df))  # Show up to 20 rows in preview
        return jsonify({
            'columns': df.columns.tolist(),
            'preview': df.head(preview_rows).to_dict('records'),
            'all_data': df.to_dict('records'),  # Send all rows
            'total_rows': len(df)
        })
    except Exception as e:
        return jsonify({'error': f"Error reading file: {str(e)}"}), 400

def wrap_text_to_width(draw, text, font, max_width):
    """Helper function to wrap text based on given width"""
    words = text.split()
    lines = []
    current_line = []
    
    if not words:
        return []
    
    for word in words:
        # Try adding the word to the current line
        test_line = current_line + [word]
        test_width = draw.textlength(' '.join(test_line), font=font)
        
        if test_width <= max_width:
            current_line.append(word)
        else:
            # If current line has words, add it to lines
            if current_line:
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                # If a single word is too long, split it
                chars = list(word)
                current_chars = []
                for char in chars:
                    test_chars = current_chars + [char]
                    if draw.textlength(''.join(test_chars), font=font) <= max_width:
                        current_chars.append(char)
                    else:
                        if current_chars:
                            lines.append(''.join(current_chars))
                            current_chars = [char]
                        else:
                            lines.append(char)
                if current_chars:
                    current_line = [''.join(current_chars)]
    
    # Add the last line if there's anything left
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines

def draw_text_box(draw, box, text, img_width, img_height):
    """Helper function to draw text box with proper wrapping and alignment"""
    try:
        # Get font size and validate
        font_size = int(box.get('fontSize', 24))
        if font_size < 8:
            font_size = 8
        elif font_size > 200:
            font_size = 200
            
        # Get font family and style
        font_family = box.get('fontFamily', 'Arial')
        
        # Convert string 'true'/'false' to boolean
        def str_to_bool(val):
            if isinstance(val, bool):
                return val
            return str(val).lower() == 'true'
        
        # Check for bold/italic styles
        is_bold = str_to_bool(box.get('bold', False))
        is_italic = str_to_bool(box.get('italic', False))
        is_underline = str_to_bool(box.get('underline', False))
        is_strikethrough = str_to_bool(box.get('strikethrough', False))
        
        # Get text alignment
        text_align = box.get('align', 'left')
        
        # Create appropriate font based on style
        font_path = get_font_path(font_family, bold=is_bold, italic=is_italic)
        font = ImageFont.truetype(font_path, font_size)
        
        # Get color (default to black)
        color_str = box.get('color', '#000000')
        if color_str.startswith('#'):
            r = int(color_str[1:3], 16)
            g = int(color_str[3:5], 16)
            b = int(color_str[5:7], 16)
            color = (r, g, b)
        else:
            color = (0, 0, 0)  # Default to black
        
        # Calculate box position and dimensions
        x = int(float(box.get('x', 0)))
        y = int(float(box.get('y', 0)))
        width = int(float(box.get('width', 100)))
        height = int(float(box.get('height', 50)))
        
        # Skip if outside image bounds
        if x > img_width or y > img_height:
            print(f"Warning: Box at ({x},{y}) is outside image bounds")
            return
        
        # Wrap text to fit width
        wrapped_lines = wrap_text_to_width(draw, str(text), font, width)
        
        # Calculate line height and total text height
        line_height = int(font_size * 1.2)  # Approx line height
        total_text_height = len(wrapped_lines) * line_height
        
        # Handle vertical alignment (center text in box by default)
        start_y = y
        if total_text_height < height:
            start_y = y + (height - total_text_height) // 2
        
        # Draw each line with proper alignment
        for i, line in enumerate(wrapped_lines):
            # Get line width for alignment
            line_width = draw.textlength(line, font=font)
            
            # Calculate x position based on alignment
            line_x = x
            if text_align == 'center':
                line_x = x + (width - line_width) // 2
            elif text_align == 'right':
                line_x = x + (width - line_width)
            
            # Calculate y position for this line
            line_y = start_y + i * line_height
            
            # Skip if outside image bounds
            if line_y > img_height:
                break
            
            # Draw the text
            draw.text((line_x, line_y), line, fill=color, font=font)
            
            # Draw underline if needed
            if is_underline:
                underline_y = line_y + font_size * 0.9  # Position underline slightly below text
                draw.line((line_x, underline_y, line_x + line_width, underline_y), fill=color, width=max(1, font_size // 20))
            
            # Draw strikethrough if needed
            if is_strikethrough:
                # Position strikethrough exactly in the middle of text
                strike_y = line_y + (font_size * 0.4)  # Position strikethrough through the middle of text
                # Make the strikethrough line a bit thicker for better visibility
                line_thickness = max(1, font_size // 15)
                draw.line((line_x, strike_y, line_x + line_width, strike_y), fill=color, width=line_thickness)
                
    except Exception as e:
        print(f"Error drawing text box: {e}")

def draw_image_box(draw, box, image_url, img_width, img_height):
    """Helper function to draw image from URL into a box"""
    try:
        # Get box dimensions and position
        x = float(box['x'])
        y = float(box['y'])
        box_width = float(box.get('width', img_width - x))
        box_height = float(box.get('height', img_height - y))
        
        try:
            # Download and open the image from URL
            response = requests.get(image_url, timeout=5)
            if response.status_code == 200:
                overlay_img = Image.open(BytesIO(response.content))
                
                # Calculate dimensions while maintaining aspect ratio
                overlay_width, overlay_height = overlay_img.size
                scale = min(box_width/overlay_width, box_height/overlay_height)
                new_width = int(overlay_width * scale)
                new_height = int(overlay_height * scale)
                
                # Resize the overlay image
                overlay_img = overlay_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Position image at exact box coordinates - no centering adjustment
                # This ensures the image appears exactly where the box is placed
                paste_x = int(x)
                paste_y = int(y)
                
                # If the overlay has transparency, use it as mask
                if overlay_img.mode in ('RGBA', 'LA'):
                    # Extract the alpha channel as mask
                    mask = overlay_img.split()[-1] if overlay_img.mode == 'RGBA' else overlay_img.split()[1]
                    # Convert to RGB for pasting
                    overlay_img = overlay_img.convert('RGB')
                    return (overlay_img, (paste_x, paste_y), mask)
                else:
                    return (overlay_img, (paste_x, paste_y))
                    
        except Exception as e:
            print(f"Error processing image URL: {str(e)}")
            # Draw an error placeholder
            draw.rectangle([x, y, x + box_width, y + box_height], outline='red', width=2)
            draw.text((x + 10, y + box_height/2), f"Image Error: {str(e)[:50]}...", fill='red')
            
    except Exception as e:
        print(f"Error drawing image box: {str(e)}")

@app.route('/preview_combined_images', methods=['POST'])
def preview_combined_images():
    import sys
    is_vercel = 'VERCEL' in os.environ or sys.platform == 'linux'
    global preview_progress
    reset_preview_progress()
    update_preview_progress(5, "starting")
    data = request.get_json()
    if not data:
        reset_preview_progress()
        return jsonify({'error': 'No data received'}), 400
    template_filename = data.get('template')
    csv_data = data.get('csv_data', [])
    boxes = data.get('text_boxes', [])
    if not template_filename or not csv_data or not boxes:
        reset_preview_progress()
        return jsonify({'error': 'Missing required parameters'}), 400
    try:
        template_path = os.path.join(app.config['UPLOAD_FOLDER'], template_filename)
        if not os.path.exists(template_path):
            reset_preview_progress()
            return jsonify({'error': f'Template file not found: {template_filename}'}), 404
        update_preview_progress(10, "preparing")
        # Use /tmp for previews on Vercel
        preview_dir = '/tmp' if is_vercel else os.path.join('static', 'previews')
        os.makedirs(preview_dir, exist_ok=True)
        if not is_vercel:
            clear_directory(preview_dir, pattern="preview_*.png")
        update_preview_progress(15, "loading template")
        template_img = Image.open(template_path)
        preview_urls = []
        max_previews = min(len(csv_data), 10) if len(csv_data) > 10 else len(csv_data)
        update_preview_progress(20, "generating previews")
        for idx, row in enumerate(csv_data[:max_previews]):
            current_progress = 20 + (70 * (idx / max(1, max_previews - 1)))
            update_preview_progress(current_progress, f"generating image {idx+1}/{max_previews}")
            img = template_img.copy()
            if img.mode not in ('RGB', 'RGBA'):
                img = img.convert('RGBA')
            draw = ImageDraw.Draw(img)
            for box in boxes:
                column = box.get('column')
                if column not in row:
                    print(f"Warning: Column '{column}' not found in CSV row {idx}")
                    continue
                x = float(box.get('x', 0))
                y = float(box.get('y', 0))
                width = float(box.get('width', 100))
                height = float(box.get('height', 100))
                if box.get('isImage', False):
                    image_url = row[column]
                    if image_url:
                        try:
                            result = draw_image_box(draw, box, image_url, img.width, img.height)
                            if result:
                                if len(result) == 3:
                                    overlay, pos, mask = result
                                    if overlay.mode != 'RGBA':
                                        overlay = overlay.convert('RGBA')
                                    img.paste(overlay, pos, mask)
                                else:
                                    overlay, pos = result
                                    if img.mode == 'RGBA' and overlay.mode != 'RGBA':
                                        overlay = overlay.convert('RGBA')
                                    elif img.mode == 'RGB' and overlay.mode != 'RGB':
                                        overlay = overlay.convert('RGB')
                                    img.paste(overlay, pos)
                            else:
                                draw.rectangle([(x, y), (x + width, y + height)], outline='red', width=2)
                                draw.text((x + 5, y + 5), "Image Error", fill='red', font=ImageFont.truetype(DEFAULT_FONT, 12))
                        except Exception as e:
                            print(f"Error drawing image from {image_url}: {str(e)}")
                            draw.rectangle([(x, y), (x + width, y + height)], outline='red', width=2)
                            draw.text((x + 5, y + 5), f"Error: {str(e)[:30]}...", fill='red', font=ImageFont.truetype(DEFAULT_FONT, 12))
                else:
                    if row[column]:
                        font_size = int(box.get('fontSize', 24))
                        font_family = box.get('fontFamily', 'Arial')
                        color_hex = box.get('color', '#000000')
                        if not color_hex.startswith('#'):
                            color_hex = '#000000'
                        color = tuple(int(color_hex.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
                        bold = box.get('bold', False)
                        italic = box.get('italic', False)
                        underline = box.get('underline', False)
                        strikethrough = box.get('strikethrough', False)
                        align = box.get('align', 'left')
                        text_box = {
                            'x': x,
                            'y': y,
                            'width': width,
                            'height': height,
                            'fontSize': font_size,
                            'fontFamily': font_family,
                            'color': color_hex,
                            'bold': str(bold).lower(),
                            'italic': str(italic).lower(),
                            'underline': str(underline).lower(),
                            'strikethrough': str(strikethrough).lower(),
                            'align': align
                        }
                        draw_text_box(draw, text_box, row[column], img.width, img.height)
            preview_filename = f'preview_{idx}_{int(datetime.now().timestamp() * 1000)}.png'
            preview_path = os.path.join(preview_dir, preview_filename)
            img.save(preview_path)
            if is_vercel:
                preview_url = url_for('serve_tmp_file', filename=preview_filename, _external=False) + f"?v={int(datetime.now().timestamp())}"
            else:
                preview_url = url_for('static', filename=f'previews/{preview_filename}', _external=False) + f"?v={int(datetime.now().timestamp())}"
            preview_urls.append(preview_url)
        update_preview_progress(95, "finalizing")
        time.sleep(0.5)
        update_preview_progress(100, "complete")
        return jsonify({
            'preview_urls': preview_urls,
            'message': f'Generated {len(preview_urls)} preview images'
        })
    except Exception as e:
        print(f"Error generating preview: {str(e)}")
        reset_preview_progress()
        return jsonify({'error': str(e)}), 500

def generate_unique_id(length=8):
    """Generate a random string of fixed length."""
    letters = string.ascii_lowercase + string.digits
    return ''.join(random.choice(letters) for i in range(length))

@app.route('/download_individual', methods=['POST'])
def download_individual():
    import sys
    is_vercel = 'VERCEL' in os.environ or sys.platform == 'linux'
    global download_progress
    reset_download_progress()
    update_download_progress(5, "starting")
    data = request.get_json()
    if not data or 'preview_urls' not in data:
        reset_download_progress()
        return jsonify({'error': 'No preview URLs provided'}), 400
    preview_urls = data.get('preview_urls', [])
    if not preview_urls:
        reset_download_progress()
        return jsonify({'error': 'Empty preview URLs list'}), 400
    try:
        timestamp = int(datetime.now().timestamp())
        unique_id = generate_unique_id()
        download_dir = os.path.join('/tmp' if is_vercel else 'static/downloads', f'batch_{timestamp}_{unique_id}')
        os.makedirs(download_dir, exist_ok=True)
        update_download_progress(15, "preparing files")
        file_paths = []
        total_urls = len(preview_urls)
        for idx, url in enumerate(preview_urls):
            current_progress = 15 + (70 * (idx / max(1, total_urls - 1)))
            update_download_progress(current_progress, f"preparing file {idx+1}/{total_urls}")
            filename = os.path.basename(url.split('?')[0])
            # Use /tmp for previews on Vercel, else static/previews
            src_path = os.path.join('/tmp' if is_vercel else 'static/previews', filename)
            dst_filename = f'image_{idx+1}.png'
            dst_path = os.path.join(download_dir, dst_filename)
            shutil.copy2(src_path, dst_path)
            file_paths.append(dst_path)
        update_download_progress(90, "finalizing")
        time.sleep(0.5)
        update_download_progress(100, "complete")
        return jsonify({
            'download_dir': download_dir,
            'file_count': len(file_paths),
            'timestamp': timestamp,
            'unique_id': unique_id
        })
    except Exception as e:
        print(f"Error preparing downloads: {str(e)}")
        reset_download_progress()
        return jsonify({'error': str(e)}), 500

def delayed_file_cleanup(zip_path, download_dir, delay=30):
    """Clean up files after a delay to allow for re-downloads."""
    def cleanup_task():
        # Sleep for the specified delay
        time.sleep(delay)
        try:
            # Check if the file still exists before trying to remove it
            if os.path.exists(zip_path):
                print(f"Delayed cleanup: Removing zip file {zip_path}")
                os.remove(zip_path)
            else:
                print(f"Zip file {zip_path} already removed")
                
            if os.path.exists(download_dir):
                print(f"Delayed cleanup: Removing directory {download_dir}")
                shutil.rmtree(download_dir)
            else:
                print(f"Directory {download_dir} already removed")
        except Exception as e:
            print(f"Error in delayed cleanup: {str(e)}")
    
    # Start a new thread to handle the cleanup
    cleanup_thread = threading.Thread(target=cleanup_task)
    cleanup_thread.daemon = True  # Allow the thread to exit when the main program exits
    cleanup_thread.start()
    print(f"Scheduled cleanup for {zip_path} in {delay} seconds")

@app.route('/download_batch/<int:timestamp>/<string:unique_id>')
def download_batch(timestamp, unique_id):
    import sys
    is_vercel = 'VERCEL' in os.environ or sys.platform == 'linux'
    download_dir = os.path.join('/tmp' if is_vercel else 'static/downloads', f'batch_{timestamp}_{unique_id}')
    if not os.path.exists(download_dir):
        return "Download batch not found", 404
    zip_filename = f'images_{timestamp}_{unique_id}.zip'
    zip_path = os.path.join('/tmp' if is_vercel else 'static/downloads', zip_filename)
    try:
        if not os.path.exists(zip_path):
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(download_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, download_dir)
                        zipf.write(file_path, arcname=arcname)
            print(f"Created zip file: {zip_path}")
        else:
            print(f"Using existing zip file: {zip_path}")
        delayed_file_cleanup(zip_path, download_dir)
        return send_file(zip_path, as_attachment=True, download_name=zip_filename)
    except Exception as e:
        print(f"Error creating or sending zip file: {e}")
        return "Error creating download file.", 500

def clear_directory(directory_path, pattern="*.png"):
    """Helper function to remove files matching a pattern in a directory."""
    files = glob.glob(os.path.join(directory_path, pattern))
    for f in files:
        try:
            os.remove(f)
            print(f"Removed old file: {f}")
        except OSError as e:
            print(f"Error removing file {f}: {e.strerror}")

# Progress tracking routes
@app.route('/preview_progress')
def get_preview_progress():
    """Return the current preview generation progress"""
    return jsonify(preview_progress)

@app.route('/download_progress')
def get_download_progress():
    """Return the current download preparation progress"""
    return jsonify(download_progress)

# Reset preview progress
def reset_preview_progress():
    """Reset the preview progress to initial state"""
    global preview_progress
    preview_progress = {"percent": 0, "status": "idle"}

# Reset download progress
def reset_download_progress():
    """Reset the download progress to initial state"""
    global download_progress
    download_progress = {"percent": 0, "status": "idle"}

# Update preview progress
def update_preview_progress(percent, status="processing"):
    """Update the preview progress"""
    global preview_progress
    preview_progress["percent"] = percent
    preview_progress["status"] = status

# Update download progress
def update_download_progress(percent, status="processing"):
    """Update the download progress"""
    global download_progress
    download_progress["percent"] = percent
    download_progress["status"] = status

# Serve files from /tmp for Vercel
@app.route('/tmp/<path:filename>')
def serve_tmp_file(filename):
    return send_file(os.path.join('/tmp', filename))

if __name__ == '__main__':
    # For development
    app.run(debug=True) 
    # For production on Hostinger
    # app.run(host='0.0.0.0', port=5000) 