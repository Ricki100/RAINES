from flask import Flask, render_template, request, jsonify, send_file, url_for
from werkzeug.utils import secure_filename
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

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_template', methods=['POST'])
def upload_template():
    if 'template' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['template']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Return the URL for the uploaded image
    image_url = url_for('static', filename=f'uploads/{filename}')
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
        df = pd.read_csv(file)
        return jsonify({
            'columns': df.columns.tolist(),
            'preview': df.head().to_dict('records')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

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
        font_size = int(box['size'])
        font_family = box.get('fontFamily', 'arial.ttf')
        try:
            font = ImageFont.truetype(font_family, font_size)
        except:
            font = ImageFont.truetype('arial.ttf', font_size)
        
        # Get box dimensions and position
        x = float(box['x'])
        y = float(box['y'])
        box_width = float(box.get('width', img_width - x))
        box_height = float(box.get('height', img_height - y))
        
        # Wrap text to fit box width
        wrapped_lines = wrap_text_to_width(draw, text, font, box_width)
        
        # Calculate line height and total text height
        line_spacing = font_size * 1.2
        total_height = len(wrapped_lines) * line_spacing
        
        # Draw each line with proper alignment
        current_y = y
        for line in wrapped_lines:
            # Calculate line width for alignment
            line_width = draw.textlength(line, font=font)
            
            # Calculate x position based on alignment
            line_x = x
            align = box.get('align', 'left')
            
            if align == 'center':
                line_x = x + (box_width - line_width) / 2
            elif align == 'right':
                line_x = x + box_width - line_width
            
            # Draw the line
            draw.text((line_x, current_y), line, fill=box['color'], font=font)
            
            # Draw underline if specified
            if box.get('underline', False):
                underline_y = current_y + font_size
                draw.line([(line_x, underline_y), (line_x + line_width, underline_y)],
                         fill=box['color'], width=max(1, int(font_size/20)))
            
            current_y += line_spacing
            
            # Stop if we exceed box height
            if current_y - y > box_height:
                break
                
    except Exception as e:
        print(f"Error drawing text box: {str(e)}")

@app.route('/preview_images', methods=['POST'])
def preview_images():
    try:
        data = request.get_json()
        template_path = os.path.join(app.config['UPLOAD_FOLDER'], data['template'])
        csv_data = data['csv_data']
        text_boxes = data['text_boxes']
        
        # Create previews directory if it doesn't exist
        preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
        os.makedirs(preview_dir, exist_ok=True)
        
        # Clear any existing preview files
        for file in os.listdir(preview_dir):
            if file.startswith('preview_') and file.endswith('.png'):
                os.remove(os.path.join(preview_dir, file))
        
        preview_urls = []
        
        for i, row in enumerate(csv_data):
            img = Image.open(template_path)
            draw = ImageDraw.Draw(img)
            img_width, img_height = img.size
            
            for box in text_boxes:
                text = str(row[box['column']])
                draw_text_box(draw, box, text, img_width, img_height)
            
            preview_filename = f'preview_{i}.png'
            preview_path = os.path.join(preview_dir, preview_filename)
            
            # Save the image with explicit format
            img.save(preview_path, format='PNG')
            
            # Verify the file was created
            if os.path.exists(preview_path):
                preview_urls.append(url_for('static', filename=f'uploads/previews/{preview_filename}'))
            else:
                print(f"Warning: Failed to save preview file: {preview_path}")
        
        if not preview_urls:
            return jsonify({'error': 'No preview images were generated'}), 500
        
        return jsonify({
            'preview_urls': preview_urls,
            'message': f'Generated {len(preview_urls)} preview images'
        })
        
    except Exception as e:
        print(f"Error in preview_images: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/download_previews', methods=['POST'])
def download_previews():
    try:
        data = request.get_json()
        preview_urls = data['preview_urls']
        
        # Create a BytesIO object to store the zip file
        memory_file = BytesIO()
        
        # Create the zip file
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
            
            # Add each preview image to the zip file
            for i, url in enumerate(preview_urls):
                preview_filename = f'preview_{i}.png'
                preview_path = os.path.join(preview_dir, preview_filename)
                
                # Verify file exists and is readable
                if os.path.exists(preview_path) and os.access(preview_path, os.R_OK):
                    # Read the image file and add it to the zip
                    with open(preview_path, 'rb') as img_file:
                        zf.writestr(preview_filename, img_file.read())
        
        # Reset the pointer to the beginning of the BytesIO object
        memory_file.seek(0)
        
        # Create the response
        response = send_file(
            memory_file,
            mimetype='application/zip',
            as_attachment=True,
            download_name='preview_images.zip'
        )
        
        # Add headers to prevent caching
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        return response
            
    except Exception as e:
        print(f"Error in download_previews: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate_images', methods=['POST'])
def generate_images():
    try:
        data = request.get_json()
        # Construct the full path to the template in the uploads directory
        template_path = os.path.join(app.config['UPLOAD_FOLDER'], data['template'])
        csv_data = data['csv_data']
        text_boxes = data['text_boxes']
        
        # Verify template file exists
        if not os.path.exists(template_path):
            return jsonify({'error': f'Template file not found: {template_path}'}), 404
        
        # Create a temporary directory for the generated images
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'generated_images.zip')
        
        # Create a ZIP file
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for i, row in enumerate(csv_data):
                img = Image.open(template_path)
                draw = ImageDraw.Draw(img)
                img_width, img_height = img.size
                
                for box in text_boxes:
                    text = str(row[box['column']])
                    draw_text_box(draw, box, text, img_width, img_height)
                
                # Save the image to the ZIP file
                img_path = f'image_{i+1}.png'
                img_buffer = BytesIO()
                img.save(img_buffer, format='PNG')
                zipf.writestr(img_path, img_buffer.getvalue())
        
        # Return the ZIP file
        return send_file(zip_path, as_attachment=True, download_name='generated_images.zip')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
        
    finally:
        # Clean up temporary directory
        if 'temp_dir' in locals():
            shutil.rmtree(temp_dir)

if __name__ == '__main__':
    app.run(debug=True) 