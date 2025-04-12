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

def wrap_text(draw, text, font, max_width):
    """Helper function to wrap text based on given width"""
    words = text.split()
    lines = []
    current_line = []
    
    for word in words:
        current_line.append(word)
        # Check the width of the current line
        line_width = draw.textlength(' '.join(current_line), font=font)
        if line_width > max_width:
            # Remove the last word if we exceeded the width
            if len(current_line) > 1:
                current_line.pop()
                lines.append(' '.join(current_line))
                current_line = [word]
            else:
                # If a single word is too long, keep it on its own line
                lines.append(word)
                current_line = []
    
    # Add the last line if there's anything left
    if current_line:
        lines.append(' '.join(current_line))
    
    return lines

@app.route('/generate_images', methods=['POST'])
def generate_images():
    try:
        data = request.get_json()
        template_path = data['template']
        csv_data = data['csv_data']
        text_boxes = data['text_boxes']

        # Create a temporary directory for the generated images
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'generated_images.zip')

        # Create a ZIP file
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            # Process each row in the CSV data
            for i, row in enumerate(csv_data):
                # Open the template image
                img = Image.open(template_path)
                draw = ImageDraw.Draw(img)

                # Add text for each text box
                for box in text_boxes:
                    text = str(row[box['column']])
                    font_size = int(box['size'])
                    font_family = box.get('fontFamily', 'arial.ttf')
                    
                    # Handle font style
                    font_style = []
                    if box.get('bold', False):
                        font_style.append('Bold')
                    if box.get('italic', False):
                        font_style.append('Italic')
                    
                    # Construct font style string
                    font_style_str = ' '.join(font_style) if font_style else 'Regular'
                    try:
                        font = ImageFont.truetype(font_family, font_size)
                    except:
                        # Fallback to default font if specified font not found
                        font = ImageFont.truetype('arial.ttf', font_size)
                    
                    # Get text box dimensions
                    box_width = box.get('width', 0)
                    box_height = box.get('height', 0)
                    
                    # Wrap text to fit within box width
                    wrapped_lines = wrap_text(draw, text, font, box_width)
                    
                    # Calculate total text height
                    line_height = font_size * 1.2  # Add some line spacing
                    total_text_height = len(wrapped_lines) * line_height
                    
                    # Calculate starting Y position to vertically center the text
                    x = box['x']
                    y = box['y']
                    
                    # Draw each line of text
                    current_y = y
                    for line in wrapped_lines:
                        # Calculate line width for alignment
                        line_width = draw.textlength(line, font=font)
                        
                        # Adjust x position based on alignment
                        align = box.get('align', 'left')
                        line_x = x
                        if align == 'center':
                            line_x = x + (box_width - line_width) / 2
                        elif align == 'right':
                            line_x = x + box_width - line_width
                        
                        # Draw the line
                        draw.text((line_x, current_y), line, fill=box['color'], font=font)
                        
                        # Draw underline if specified
                        if box.get('underline', False):
                            y_underline = current_y + font_size
                            draw.line([(line_x, y_underline), (line_x + line_width, y_underline)], 
                                    fill=box['color'], width=max(1, int(font_size/20)))
                        
                        current_y += line_height

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

@app.route('/preview_images', methods=['POST'])
def preview_images():
    data = request.json
    template_path = os.path.join(app.config['UPLOAD_FOLDER'], data['template'])
    csv_data = data['csv_data']
    text_boxes = data['text_boxes']
    
    try:
        preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
        os.makedirs(preview_dir, exist_ok=True)
        
        preview_urls = []
        
        for i, row in enumerate(csv_data):
            img = Image.open(template_path)
            draw = ImageDraw.Draw(img)
            
            for box in text_boxes:
                text = str(row[box['column']])
                font_size = int(box['size'])
                font_family = box.get('fontFamily', 'arial.ttf')
                
                # Handle font style
                font_style = []
                if box.get('bold', False):
                    font_style.append('Bold')
                if box.get('italic', False):
                    font_style.append('Italic')
                
                # Construct font style string
                font_style_str = ' '.join(font_style) if font_style else 'Regular'
                try:
                    font = ImageFont.truetype(font_family, font_size)
                except:
                    # Fallback to default font if specified font not found
                    font = ImageFont.truetype('arial.ttf', font_size)
                
                # Get text box dimensions
                box_width = box.get('width', 0)
                box_height = box.get('height', 0)
                
                # Wrap text to fit within box width
                wrapped_lines = wrap_text(draw, text, font, box_width)
                
                # Calculate total text height
                line_height = font_size * 1.2  # Add some line spacing
                total_text_height = len(wrapped_lines) * line_height
                
                # Calculate starting Y position to vertically center the text
                x = box['x']
                y = box['y']
                
                # Draw each line of text
                current_y = y
                for line in wrapped_lines:
                    # Calculate line width for alignment
                    line_width = draw.textlength(line, font=font)
                    
                    # Adjust x position based on alignment
                    align = box.get('align', 'left')
                    line_x = x
                    if align == 'center':
                        line_x = x + (box_width - line_width) / 2
                    elif align == 'right':
                        line_x = x + box_width - line_width
                    
                    # Draw the line
                    draw.text((line_x, current_y), line, fill=box['color'], font=font)
                    
                    # Draw underline if specified
                    if box.get('underline', False):
                        y_underline = current_y + font_size
                        draw.line([(line_x, y_underline), (line_x + line_width, y_underline)], 
                                fill=box['color'], width=max(1, int(font_size/20)))
                    
                    current_y += line_height
            
            # Save preview image
            preview_filename = f'preview_{i}.png'
            preview_path = os.path.join(preview_dir, preview_filename)
            img.save(preview_path)
            preview_urls.append(url_for('static', filename=f'uploads/previews/{preview_filename}'))
        
        return jsonify({
            'preview_urls': preview_urls,
            'message': f'Generated {len(preview_urls)} preview images'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 