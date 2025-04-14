let csvData = [];
let textBoxes = [];
let selectedTextBox = null;

// Add error handling function
function displayError(message) {
    alert(message);
    console.error(message);
    const statusDiv = document.getElementById('generationStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = 'mt-3 text-danger';
    }
}

// CSV Upload Handling
document.getElementById('csvForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('csv').files[0];
    if (!file) {
        displayError('Please select a file to upload');
        return;
    }

    // Validate file type
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
        displayError('Please upload a CSV or Excel file');
        return;
    }

    const formData = new FormData();
    formData.append('csv', file);

    try {
        const response = await fetch('/upload_csv', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
        }
        
        const data = await response.json();
        csvData = data.preview;
        updateCsvPreview(data.columns, data.preview);
        updateColumnSelect(data.columns);
    } catch (error) {
        displayError(`Error uploading file: ${error.message}`);
    }
});

function updateCsvPreview(headers, data) {
    const headersRow = document.getElementById('csvHeaders');
    const dataBody = document.getElementById('csvData');
    
    // Clear existing content
    headersRow.innerHTML = '';
    dataBody.innerHTML = '';
    
    // Add headers
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headersRow.appendChild(th);
    });
    
    // Add data rows
    data.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = row[header];
            tr.appendChild(td);
        });
        dataBody.appendChild(tr);
    });
}

function updateColumnSelect(columns) {
    const select = document.getElementById('columnSelect');
    select.innerHTML = '';
    
    columns.forEach(column => {
        const option = document.createElement('option');
        option.value = column;
        option.textContent = column;
        select.appendChild(option);
    });
}

// Text Box Management
document.getElementById('addTextBox').addEventListener('click', () => {
    const column = document.getElementById('columnSelect').value;
    const fontSize = document.getElementById('fontSize').value;
    const color = document.getElementById('fontColor').value;
    const fontFamily = document.getElementById('fontFamily').value;
    
    const textBox = document.createElement('div');
    textBox.className = 'text-box';
    
    textBox.style.fontSize = `${fontSize}px`;
    textBox.style.color = color;
    textBox.style.fontFamily = fontFamily;
    textBox.style.width = '150px';
    textBox.style.height = '50px';
    textBox.style.position = 'absolute';
    textBox.style.padding = '5px';
    textBox.style.boxSizing = 'border-box';
    textBox.style.display = 'flex';
    textBox.style.flexDirection = 'column';
    textBox.style.overflow = 'hidden';
    
    // Store styling data
    textBox.dataset.column = column;
    textBox.dataset.fontSize = fontSize;
    textBox.dataset.color = color;
    textBox.dataset.fontFamily = fontFamily;
    textBox.dataset.bold = 'false';
    textBox.dataset.italic = 'false';
    textBox.dataset.underline = 'false';
    textBox.dataset.align = 'left';
    textBox.dataset.width = '150';
    textBox.dataset.height = '50';
    
    // Create header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'text-box-header';
    headerDiv.textContent = column;
    textBox.appendChild(headerDiv);
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'text-box-content-wrapper';
    contentWrapper.style.flex = '1';
    contentWrapper.style.overflow = 'hidden';
    contentWrapper.style.width = '100%';
    contentWrapper.style.position = 'relative';
    textBox.appendChild(contentWrapper);
    
    // Create content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'text-box-content';
    contentDiv.style.wordWrap = 'break-word';
    contentDiv.style.overflowWrap = 'break-word';
    contentDiv.style.whiteSpace = 'pre-wrap';
    contentDiv.style.width = '100%';
    contentWrapper.appendChild(contentDiv);
    
    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    textBox.appendChild(resizeHandle);
    
    // Position in the center of the canvas container
    const container = document.getElementById('canvasContainer');
    const rect = container.getBoundingClientRect();
    textBox.style.left = `${rect.width / 2 - 75}px`;
    textBox.style.top = `${rect.height / 2 - 25}px`;
    
    textBox.addEventListener('click', (e) => {
        e.stopPropagation();
        selectTextBox(textBox);
    });
    
    makeDraggableAndResizable(textBox);
    document.getElementById('textBoxes').appendChild(textBox);
    textBoxes.push(textBox);
    selectTextBox(textBox);
    updateTextBoxPreview(textBox);
});

function selectTextBox(textBox) {
    if (selectedTextBox) {
        selectedTextBox.classList.remove('selected');
    }
    selectedTextBox = textBox;
    textBox.classList.add('selected');
    
    // Update form controls
    document.getElementById('columnSelect').value = textBox.dataset.column;
    document.getElementById('fontSize').value = textBox.dataset.fontSize;
    document.getElementById('fontColor').value = textBox.dataset.color;
    document.getElementById('fontFamily').value = textBox.dataset.fontFamily;
}

function makeDraggableAndResizable(element) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startWidth, startHeight;
    
    const header = element.querySelector('.text-box-header');
    const resizeHandle = element.querySelector('.resize-handle');
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - element.offsetLeft;
        startY = e.clientY - element.offsetTop;
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const container = document.getElementById('canvasContainer');
            const rect = container.getBoundingClientRect();
            
            let newLeft = e.clientX - startX;
            let newTop = e.clientY - startY;
            
            // Constrain to container bounds
            newLeft = Math.max(0, Math.min(newLeft, rect.width - element.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, rect.height - element.offsetHeight));
            
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        } else if (isResizing) {
            const newWidth = Math.max(50, startWidth + (e.clientX - startX));
            const newHeight = Math.max(30, startHeight + (e.clientY - startY));
            
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
            element.dataset.width = newWidth;
            element.dataset.height = newHeight;
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
        isResizing = false;
    });
}

// Font Management
const availableFonts = [
    { name: 'Arial', file: 'arial.ttf' },
    { name: 'Arial Bold', file: 'arial-bold.ttf' },
    { name: 'Arial Italic', file: 'arial-italic.ttf' },
    { name: 'Times New Roman', file: 'times.ttf' },
    { name: 'Times New Roman Bold', file: 'times-bold.ttf' },
    { name: 'Times New Roman Italic', file: 'times-italic.ttf' },
    { name: 'Helvetica', file: 'helvetica.ttf' },
    { name: 'Helvetica Bold', file: 'helvetica-bold.ttf' },
    { name: 'Helvetica Italic', file: 'helvetica-italic.ttf' },
    { name: 'Georgia', file: 'georgia.ttf' },
    { name: 'Georgia Bold', file: 'georgia-bold.ttf' },
    { name: 'Georgia Italic', file: 'georgia-italic.ttf' },
    { name: 'Verdana', file: 'verdana.ttf' },
    { name: 'Verdana Bold', file: 'verdana-bold.ttf' },
    { name: 'Verdana Italic', file: 'verdana-italic.ttf' },
    { name: 'Courier New', file: 'cour.ttf' },
    { name: 'Courier New Bold', file: 'cour-bold.ttf' },
    { name: 'Courier New Italic', file: 'cour-italic.ttf' }
];

// Update font family select with available fonts
function updateFontSelect() {
    const select = document.getElementById('fontFamily');
    select.innerHTML = availableFonts
        .filter(font => font.name.includes('Bold') === false && font.name.includes('Italic') === false)
        .map(font => `<option value="${font.name}">${font.name}</option>`)
        .join('');
}

// Initialize font select
updateFontSelect();

// Text styling controls
document.getElementById('boldText').addEventListener('click', function() {
    const textBox = selectedTextBox;
    if (textBox) {
        const isBold = textBox.dataset.bold === 'true';
        textBox.dataset.bold = (!isBold).toString();
        this.classList.toggle('active', !isBold);
        updateTextBoxPreview(textBox);
    }
});

document.getElementById('italicText').addEventListener('click', function() {
    const textBox = selectedTextBox;
    if (textBox) {
        const isItalic = textBox.dataset.italic === 'true';
        textBox.dataset.italic = (!isItalic).toString();
        this.classList.toggle('active', !isItalic);
        updateTextBoxPreview(textBox);
    }
});

document.getElementById('underlineText').addEventListener('click', function() {
    const textBox = selectedTextBox;
    if (textBox) {
        const isUnderline = textBox.dataset.underline === 'true';
        textBox.dataset.underline = (!isUnderline).toString();
        this.classList.toggle('active', !isUnderline);
        updateTextBoxPreview(textBox);
    }
});

// Font size adjustment
document.getElementById('increaseFontSize').addEventListener('click', () => {
    if (!selectedTextBox) return;
    const currentSize = parseInt(document.getElementById('fontSize').value);
    const newSize = Math.min(currentSize + 2, 200); // Cap at 200px
    document.getElementById('fontSize').value = newSize;
    selectedTextBox.style.fontSize = newSize + 'px';
    selectedTextBox.dataset.fontSize = newSize;
    updateTextBoxPreview(selectedTextBox);
});

document.getElementById('decreaseFontSize').addEventListener('click', () => {
    if (!selectedTextBox) return;
    const currentSize = parseInt(document.getElementById('fontSize').value);
    const newSize = Math.max(currentSize - 2, 8); // Minimum 8px
    document.getElementById('fontSize').value = newSize;
    selectedTextBox.style.fontSize = newSize + 'px';
    selectedTextBox.dataset.fontSize = newSize;
    updateTextBoxPreview(selectedTextBox);
});

// Font size input change
document.getElementById('fontSize').addEventListener('change', (e) => {
    if (!selectedTextBox) return;
    let newSize = parseInt(e.target.value);
    // Enforce size limits
    if (newSize < 8) newSize = 8;
    if (newSize > 200) newSize = 200;
    e.target.value = newSize;
    selectedTextBox.style.fontSize = newSize + 'px';
    selectedTextBox.dataset.fontSize = newSize;
    updateTextBoxPreview(selectedTextBox);
});

// Font color control
document.getElementById('fontColor').addEventListener('change', function() {
    const textBox = selectedTextBox;
    if (textBox) {
        textBox.dataset.color = this.value;
        updateTextBoxPreview(textBox);
    }
});

// Font family control
document.getElementById('fontFamily').addEventListener('change', function() {
    const textBox = selectedTextBox;
    if (textBox) {
        textBox.dataset.fontFamily = this.value;
        updateTextBoxPreview(textBox);
    }
});

// Text alignment controls
document.querySelectorAll('[data-align]').forEach(button => {
    button.addEventListener('click', function() {
        const textBox = selectedTextBox;
        if (textBox) {
            const align = this.dataset.align;
            textBox.dataset.align = align;
            document.querySelectorAll('[data-align]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === align);
            });
            updateTextBoxPreview(textBox);
        }
    });
});

// Update text box preview with styling
function updateTextBoxPreview(textBox) {
    const column = textBox.dataset.column;
    if (csvData && csvData.length > 0 && column in csvData[0]) {
        const previewText = csvData[0][column];
        const contentDiv = textBox.querySelector('.text-box-content');
        
        // Apply all styles
        contentDiv.style.fontSize = `${textBox.dataset.fontSize}px`;
        contentDiv.style.color = textBox.dataset.color;
        contentDiv.style.fontFamily = textBox.dataset.fontFamily;
        contentDiv.style.fontWeight = textBox.dataset.bold === 'true' ? 'bold' : 'normal';
        contentDiv.style.fontStyle = textBox.dataset.italic === 'true' ? 'italic' : 'normal';
        contentDiv.style.textDecoration = textBox.dataset.underline === 'true' ? 'underline' : 'none';
        contentDiv.style.textAlign = textBox.dataset.align || 'left';
        
        contentDiv.textContent = previewText;
    }
}

// Preview Images
document.getElementById('previewBtn').addEventListener('click', async () => {
    if (!window.fullCsvData || textBoxes.length === 0) {
        alert('Please complete all steps before previewing images');
        return;
    }
    
    const previewBtn = document.getElementById('previewBtn');
    const originalText = previewBtn.textContent;
    
    try {
        // Show loading state
        previewBtn.textContent = 'Generating Previews...';
        previewBtn.disabled = true;

        // Get the carousel element
        const carousel = document.getElementById('previewCarousel');
        
        const container = document.getElementById('canvasContainer');
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        // Get text box configurations
        const textBoxConfigs = Array.from(document.querySelectorAll('.text-box')).map(box => {
            const rect = box.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            
            return {
                column: box.dataset.column,
                x: box.offsetLeft,
                y: box.offsetTop,
                size: parseInt(box.dataset.fontSize),
                color: box.dataset.color,
                width: parseInt(box.dataset.width),
                height: parseInt(box.dataset.height),
                fontFamily: box.dataset.fontFamily,
                bold: box.dataset.bold === 'true',
                italic: box.dataset.italic === 'true',
                underline: box.dataset.underline === 'true',
                align: box.dataset.align
            };
        });
        
        const response = await fetch('/generate_text_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                csv_data: window.fullCsvData,  // Use full CSV data instead of preview data
                text_boxes: textBoxConfigs,
                canvas_width: containerWidth,
                canvas_height: containerHeight
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            // Store preview URLs for download
            window.previewUrls = data.preview_urls;
            
            // Update carousel with preview images
            const carouselInner = carousel.querySelector('.carousel-inner');
            const indicators = carousel.querySelector('.carousel-indicators');
            
            // Clear existing carousel content
            carouselInner.innerHTML = '';
            indicators.innerHTML = '';
            
            // Add new preview images
            carouselInner.innerHTML = data.preview_urls.map((url, index) => `
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                    <img src="${url}" class="d-block w-100" alt="Preview ${index + 1}">
                    <div class="carousel-caption d-none d-md-block">
                        <h5>Preview ${index + 1} of ${data.preview_urls.length}</h5>
                    </div>
                </div>
            `).join('');
            
            indicators.innerHTML = data.preview_urls.map((_, index) => `
                <button type="button" 
                    data-bs-target="#previewCarousel" 
                    data-bs-slide-to="${index}"
                    ${index === 0 ? 'class="active" aria-current="true"' : ''}
                    aria-label="Slide ${index + 1}">
                </button>
            `).join('');
            
            // Initialize or refresh the carousel
            if (carousel.classList.contains('d-none')) {
                carousel.classList.remove('d-none');
            } else {
                // Force a refresh of the carousel
                const carouselInstance = bootstrap.Carousel.getInstance(carousel);
                if (carouselInstance) {
                    carouselInstance.dispose();
                }
                new bootstrap.Carousel(carousel);
            }
            
            // Enable download button
            const downloadBtn = document.getElementById('downloadPreviewBtn');
            downloadBtn.disabled = false;
            
            // Update status
            const statusDiv = document.getElementById('generationStatus');
            statusDiv.textContent = 'Previews generated successfully!';
            statusDiv.className = 'mt-3 text-success';
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Preview error:', error);
        alert('Error generating previews: ' + error.message);
        
        // Update status for error
        const statusDiv = document.getElementById('generationStatus');
        statusDiv.textContent = 'Error generating previews: ' + error.message;
        statusDiv.className = 'mt-3 text-danger';
    } finally {
        // Reset preview button state
        previewBtn.textContent = originalText;
        previewBtn.disabled = false;
    }
});

// Download Button Handler
document.getElementById('downloadPreviewBtn').addEventListener('click', async () => {
    if (!window.previewUrls || window.previewUrls.length === 0) {
        alert('No preview images available to download');
        return;
    }

    try {
        const response = await fetch('/download_text_previews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                preview_urls: window.previewUrls
            })
        });

        if (response.ok) {
            // Create a temporary link to trigger the download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'text_previews.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading previews: ' + error.message);
    }
}); 