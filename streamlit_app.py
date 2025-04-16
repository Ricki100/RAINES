import streamlit as st
import pandas as pd
import os
import time
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import tempfile
import zipfile
import glob
import random
import string
import requests
from datetime import datetime
from io import BytesIO

# Set page config
st.set_page_config(
    page_title="Data Merge Tool",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Add CSS
st.markdown("""
<style>
    .main .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    .stDownloadButton button {
        width: 100%;
    }
</style>
""", unsafe_allow_html=True)

# Font management
FONTS_DIR = os.path.join('static', 'fonts')
DEFAULT_FONT = os.path.join(FONTS_DIR, 'Arial.ttf')

# Ensure required directories exist
os.makedirs('static/previews', exist_ok=True)
os.makedirs('static/downloads', exist_ok=True)
os.makedirs('static/uploads', exist_ok=True)
os.makedirs(FONTS_DIR, exist_ok=True)

# Create session state variables if they don't exist
if 'template' not in st.session_state:
    st.session_state.template = None
if 'csv_data' not in st.session_state:
    st.session_state.csv_data = None
if 'boxes' not in st.session_state:
    st.session_state.boxes = []
if 'preview_urls' not in st.session_state:
    st.session_state.preview_urls = []
if 'current_preview_index' not in st.session_state:
    st.session_state.current_preview_index = 0

# Font helper functions
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
        st.warning(f"Font file {font_path} not found, falling back to Arial")
        return os.path.join(FONTS_DIR, 'Arial.ttf')
    
    return font_path

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
        
        bold = str_to_bool(box.get('bold', False))
        italic = str_to_bool(box.get('italic', False))
        underline = str_to_bool(box.get('underline', False))
        
        # Get the appropriate font file based on family and style
        try:
            font_path = get_font_path(font_family, bold, italic)
            font = ImageFont.truetype(font_path, font_size)
        except Exception as e:
            st.warning(f"Error loading font {font_family}: {str(e)}. Using default font.")
            # Use the default font as fallback
            font = ImageFont.truetype(DEFAULT_FONT, font_size)
        
        # Use stroke only if we don't have a bold font variant and bold is requested
        stroke_width = 0
        if bold and font_path.lower().find('bd') == -1:
            stroke_width = max(1, font_size // 30)  # Scale stroke width with font size
        
        # Get box dimensions and position
        x = float(box.get('x', 0))
        y = float(box.get('y', 0))
        box_width = float(box.get('width', img_width - x))
        box_height = float(box.get('height', img_height - y))
        
        # Validate color
        color = box.get('color', '#000000')
        if not color.startswith('#'):
            color = '#000000'
        # Convert color from hex to RGB
        color = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
        
        # Wrap text to fit box width
        lines = wrap_text_to_width(draw, text, font, box_width - (stroke_width * 2 if bold else 0))
        
        # Calculate line height and total text height
        line_spacing = font_size * 1.2
        total_height = len(lines) * line_spacing

        # Draw each line with proper alignment
        current_y = y # Start drawing directly from the box's top y
        for line in lines:
            # Calculate line width for alignment
            bbox = draw.textbbox((0, 0), line, font=font)
            line_width = bbox[2] - bbox[0]
            
            # Calculate x position based on alignment
            line_x = x
            align = box.get('align', 'left')
            
            if align == 'center':
                line_x = x + (box_width - line_width) // 2
            elif align == 'right':
                line_x = x + box_width - line_width
            
            # Draw the line with stroke for bold simulation if needed
            if stroke_width > 0:
                # Draw the stroke
                draw.text((line_x, current_y), line, font=font, fill=color, stroke_width=stroke_width, stroke_fill=color)
            else:
                draw.text((line_x, current_y), line, font=font, fill=color)
            
            # Draw underline if specified
            if underline:
                underline_y = current_y + font_size
                underline_width = max(1, font_size // 20)
                if bold:
                    underline_width = max(underline_width, stroke_width)
                draw.line([(line_x, underline_y), (line_x + line_width, underline_y)],
                         fill=color, width=underline_width)
            
            current_y += line_spacing
            
            # Stop if we exceed box height
            if current_y - y > box_height:
                break
                
    except Exception as e:
        st.error(f"Error drawing text box: {str(e)}")
        # Draw a red rectangle to indicate error
        draw.rectangle([x, y, x + box_width, y + box_height], outline='red', width=2)
        draw.text((x + 10, y + box_height/2), f"Error: {str(e)[:50]}...", fill='red')

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
                overlay_img = overlay_img.resize((new_width, new_height), Image.LANCZOS)
                
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
            st.error(f"Error processing image URL: {str(e)}")
            # Draw an error placeholder
            draw.rectangle([x, y, x + box_width, y + box_height], outline='red', width=2)
            draw.text((x + 10, y + box_height/2), f"Image Error: {str(e)[:50]}...", fill='red')
            
    except Exception as e:
        st.error(f"Error drawing image box: {str(e)}")

def generate_unique_id(length=8):
    """Generate a random string of fixed length."""
    letters = string.ascii_lowercase + string.digits
    return ''.join(random.choice(letters) for i in range(length)) 

# Main App UI
st.title("Data Merge Tool")

# Create a two-column layout
col1, col2 = st.columns([1, 2])

with col1:
    # 1. Template Upload
    st.subheader("1. Upload Template")
    uploaded_template = st.file_uploader("Choose a template image", type=["png", "jpg", "jpeg"])
    
    if uploaded_template is not None:
        # Generate a fixed filename
        extension = os.path.splitext(uploaded_template.name)[1]
        template_filename = f'current_template{extension}'
        template_path = os.path.join('static', 'uploads', template_filename)
        
        # Save the template file
        with open(template_path, 'wb') as f:
            f.write(uploaded_template.getbuffer())
        
        # Save in session state
        st.session_state.template = {
            'filename': template_filename,
            'path': template_path
        }
        
        # Clear existing preview images when a new template is uploaded
        for f in glob.glob(os.path.join('static', 'previews', 'preview_*.png')):
            try:
                os.remove(f)
            except:
                pass
    
    # 2. CSV Upload
    st.subheader("2. Upload Data")
    uploaded_csv = st.file_uploader("Choose a CSV or Excel file", type=["csv", "xlsx", "xls"])
    
    if uploaded_csv is not None:
        try:
            # Check file extension
            if uploaded_csv.name.lower().endswith('.csv'):
                df = pd.read_csv(uploaded_csv, encoding='utf-8-sig', on_bad_lines='skip')
            elif uploaded_csv.name.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(uploaded_csv)
            
            # Save in session state
            st.session_state.csv_data = {
                'columns': df.columns.tolist(),
                'data': df.to_dict('records')
            }
            
            # Display preview
            st.write("Data Preview:")
            st.dataframe(df.head(5), use_container_width=True)
        except Exception as e:
            st.error(f"Error reading file: {str(e)}")
    
    # 3. Add Elements
    if st.session_state.template is not None and st.session_state.csv_data is not None:
        st.subheader("3. Add Elements")
        
        element_type = st.radio("Element Type", ["Text Box", "Image Box"])
        
        if element_type == "Text Box":
            with st.form("add_text_box_form"):
                col_text, col_align = st.columns(2)
                
                with col_text:
                    text_column = st.selectbox("Text Column", st.session_state.csv_data['columns'])
                    font_family = st.selectbox("Font Family", 
                                            ["Arial", "Times New Roman", "Helvetica", "Georgia", "Verdana", "Courier New"])
                
                with col_align:
                    font_size = st.number_input("Font Size", min_value=8, max_value=200, value=24)
                    text_align = st.selectbox("Alignment", ["left", "center", "right"])
                
                col_style, col_color = st.columns(2)
                
                with col_style:
                    bold = st.checkbox("Bold")
                    italic = st.checkbox("Italic")
                    underline = st.checkbox("Underline")
                
                with col_color:
                    font_color = st.color_picker("Font Color", "#000000")
                
                # Fields for position and size
                col_pos, col_size = st.columns(2)
                
                with col_pos:
                    x_pos = st.number_input("X Position", min_value=0, value=50)
                    y_pos = st.number_input("Y Position", min_value=0, value=50)
                
                with col_size:
                    width = st.number_input("Width", min_value=50, value=200)
                    height = st.number_input("Height", min_value=30, value=100)
                
                submit_text = st.form_submit_button("Add Text Box")
                if submit_text:
                    # Add to session state
                    text_box = {
                        'type': 'text',
                        'column': text_column,
                        'x': x_pos,
                        'y': y_pos,
                        'width': width,
                        'height': height,
                        'fontSize': font_size,
                        'fontFamily': font_family,
                        'color': font_color,
                        'bold': bold,
                        'italic': italic,
                        'underline': underline,
                        'align': text_align,
                        'id': generate_unique_id()
                    }
                    st.session_state.boxes.append(text_box)
                    st.success(f"Added text box for column '{text_column}'")
        
        elif element_type == "Image Box":
            with st.form("add_image_box_form"):
                image_column = st.selectbox("Image URL Column", st.session_state.csv_data['columns'])
                
                # Fields for position and size
                col_pos, col_size = st.columns(2)
                
                with col_pos:
                    x_pos = st.number_input("X Position", min_value=0, value=50)
                    y_pos = st.number_input("Y Position", min_value=0, value=50)
                
                with col_size:
                    width = st.number_input("Width", min_value=50, value=200)
                    height = st.number_input("Height", min_value=30, value=200)
                
                submit_image = st.form_submit_button("Add Image Box")
                if submit_image:
                    # Add to session state
                    image_box = {
                        'type': 'image',
                        'column': image_column,
                        'x': x_pos,
                        'y': y_pos,
                        'width': width,
                        'height': height,
                        'isImage': True,
                        'id': generate_unique_id()
                    }
                    st.session_state.boxes.append(image_box)
                    st.success(f"Added image box for column '{image_column}'")
    
    # 4. Generate and Preview
    if st.session_state.template is not None and st.session_state.csv_data is not None and len(st.session_state.boxes) > 0:
        st.subheader("4. Generate & Download")
        
        if st.button("Generate Previews"):
            with st.spinner("Generating previews..."):
                # List to store preview paths
                preview_paths = []
                
                # Get the template image
                template_img = Image.open(st.session_state.template['path'])
                
                # Get image dimensions
                img_width, img_height = template_img.size
                
                # Generate preview for each row
                for idx, row in enumerate(st.session_state.csv_data['data'][:10]):  # Limit to 10 previews for performance
                    # Create a copy of template for each row
                    img = template_img.copy()
                    
                    # Ensure image is in RGB or RGBA mode
                    if img.mode not in ('RGB', 'RGBA'):
                        img = img.convert('RGBA')
                    
                    draw = ImageDraw.Draw(img)
                    
                    # Process each box
                    for box in st.session_state.boxes:
                        column = box.get('column')
                        
                        if column not in row:
                            st.warning(f"Column '{column}' not found in CSV row {idx}")
                            continue
                        
                        # Check if it's an image box
                        if box.get('type') == 'image' or box.get('isImage', False):
                            image_url = row[column]
                            if image_url:  # Only process if URL is provided
                                result = draw_image_box(draw, box, image_url, img.width, img.height)
                                if result:
                                    if len(result) == 3:  # If mask is returned
                                        overlay, pos, mask = result
                                        img.paste(overlay, pos, mask)
                                    else:  # No mask
                                        overlay, pos = result
                                        img.paste(overlay, pos)
                        else:
                            # It's a text box
                            if row[column]:  # Only draw if text is provided
                                draw_text_box(draw, box, row[column], img.width, img.height)
                    
                    # Save preview image
                    preview_filename = f'preview_{idx}_{int(datetime.now().timestamp() * 1000)}.png'
                    preview_path = os.path.join('static', 'previews', preview_filename)
                    img.save(preview_path)
                    preview_paths.append(preview_path)
                
                # Store in session state
                st.session_state.preview_urls = preview_paths
                st.session_state.current_preview_index = 0
                
                st.success(f"Generated {len(preview_paths)} preview images!")

# Right column for displaying the template and previews
with col2:
    # Display template with boxes
    if st.session_state.template is not None:
        st.subheader("Template & Boxes")
        
        # Display the template image
        template_img = Image.open(st.session_state.template['path'])
        
        # Create a copy to draw boxes on
        img_with_boxes = template_img.copy()
        draw = ImageDraw.Draw(img_with_boxes)
        
        # Draw boxes
        for box in st.session_state.boxes:
            x = float(box.get('x', 0))
            y = float(box.get('y', 0))
            width = float(box.get('width', 100))
            height = float(box.get('height', 100))
            
            if box.get('type') == 'image' or box.get('isImage', False):
                # Draw a green dashed rectangle for image boxes
                draw.rectangle([x, y, x + width, y + height], outline='#28a745', width=2)
                draw.text((x + 5, y + 5), f"Image: {box['column']}", fill='#28a745', stroke_width=1, stroke_fill='white')
            else:
                # Draw a blue dashed rectangle for text boxes
                draw.rectangle([x, y, x + width, y + height], outline='#007bff', width=2)
                draw.text((x + 5, y + 5), f"Text: {box['column']}", fill='#007bff', stroke_width=1, stroke_fill='white')
        
        # Display the image with boxes
        st.image(img_with_boxes, use_column_width=True)
        
        # Show list of added boxes with delete option
        st.subheader("Added Elements")
        for i, box in enumerate(st.session_state.boxes):
            col_info, col_delete = st.columns([3, 1])
            with col_info:
                st.write(f"{i+1}. {box['type'].title()}: {box['column']} ({box['x']}, {box['y']}, {box['width']}x{box['height']})")
            with col_delete:
                if st.button("Delete", key=f"delete_{box['id']}"):
                    st.session_state.boxes.remove(box)
                    st.rerun()
    
    # Display preview images
    if st.session_state.preview_urls and len(st.session_state.preview_urls) > 0:
        st.subheader("Preview")
        
        # Navigation for previews
        col_prev, col_index, col_next = st.columns([1, 3, 1])
        
        with col_prev:
            if st.button("◀ Previous"):
                if st.session_state.current_preview_index > 0:
                    st.session_state.current_preview_index -= 1
                    st.rerun()
        
        with col_index:
            total_previews = len(st.session_state.preview_urls)
            st.write(f"Image {st.session_state.current_preview_index + 1} of {total_previews}")
        
        with col_next:
            if st.button("Next ▶"):
                if st.session_state.current_preview_index < len(st.session_state.preview_urls) - 1:
                    st.session_state.current_preview_index += 1
                    st.rerun()
        
        # Display current preview
        current_preview = st.session_state.preview_urls[st.session_state.current_preview_index]
        st.image(current_preview, use_column_width=True)
        
        # Download button
        if len(st.session_state.preview_urls) > 0:
            # Create a zip file with all previews
            with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_zip:
                with zipfile.ZipFile(tmp_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
                    for i, preview_path in enumerate(st.session_state.preview_urls):
                        zf.write(preview_path, f"image_{i+1}.png")
            
            # Get the data for download
            with open(tmp_zip.name, 'rb') as f:
                zip_data = f.read()
            
            # Create download button
            st.download_button(
                label="Download All Images",
                data=zip_data,
                file_name="data_merge_images.zip",
                mime="application/zip"
            ) 