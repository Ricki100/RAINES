let currentTemplate = null;
let csvData = null;
let textBoxes = [];
let selectedTextBox = null;
let originalImageSize = { width: 0, height: 0 }; // Store original image dimensions

// Template Upload
document.getElementById('templateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('template').files[0];
    const formData = new FormData();
    formData.append('template', file);

    try {
        const response = await fetch('/upload_template', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (response.ok) {
            currentTemplate = data.filename;
            const previewImage = document.getElementById('previewImage');
            previewImage.src = data.image_url;
            previewImage.classList.remove('d-none');
            
            // Initialize canvas with the actual image
            const canvas = document.getElementById('templateCanvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                // Store original image dimensions
                originalImageSize.width = img.width;
                originalImageSize.height = img.height;
                
                // Calculate aspect ratio
                const maxWidth = 800;
                const maxHeight = 600;
                let width = img.width;
                let height = img.height;
                
                // Resize while maintaining aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                // Set container size to match canvas
                const container = document.getElementById('canvasContainer');
                container.style.width = width + 'px';
                container.style.height = height + 'px';
            };
            img.src = data.image_url;
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error uploading template: ' + error.message);
    }
});

// CSV Upload
document.getElementById('csvForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = document.getElementById('csv').files[0];
    const formData = new FormData();
    formData.append('csv', file);

    try {
        const response = await fetch('/upload_csv', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (response.ok) {
            csvData = data.preview;
            updateCSVPreview(data.columns, data.preview);
            updateColumnSelect(data.columns);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Error uploading CSV: ' + error.message);
    }
});

function updateCSVPreview(columns, data) {
    const headers = document.getElementById('csvHeaders');
    const tbody = document.getElementById('csvData');
    
    // Create table headers
    headers.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;
    
    // Create table rows
    tbody.innerHTML = data.map(row => 
        `<tr>${columns.map(col => `<td>${row[col]}</td>`).join('')}</tr>`
    ).join('');
}

function updateColumnSelect(columns) {
    const select = document.getElementById('columnSelect');
    select.innerHTML = columns.map(col => 
        `<option value="${col}">${col}</option>`
    ).join('');
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
    
    // Update form values
    document.getElementById('columnSelect').value = textBox.dataset.column;
    document.getElementById('fontSize').value = textBox.dataset.fontSize;
    document.getElementById('fontColor').value = textBox.dataset.color;
    document.getElementById('fontFamily').value = textBox.dataset.fontFamily;
    
    // Update style buttons
    document.getElementById('boldText').classList.toggle('active', textBox.dataset.bold === 'true');
    document.getElementById('italicText').classList.toggle('active', textBox.dataset.italic === 'true');
    document.getElementById('underlineText').classList.toggle('active', textBox.dataset.underline === 'true');
    
    // Update alignment buttons
    document.querySelectorAll('[data-align]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.align === textBox.dataset.align);
    });
}

function makeDraggableAndResizable(element) {
    let isDragging = false;
    let isResizing = false;
    let currentX;
    let currentY;
    let initialWidth;
    let initialHeight;
    
    // Set initial size if not set
    if (!element.style.width) {
        element.style.width = '150px';
        element.style.height = '50px';
    }
    
    element.addEventListener('mousedown', onMouseDown);
    
    function onMouseDown(e) {
        if (e.target.classList.contains('resize-handle')) {
            isResizing = true;
            // Update initial dimensions each time we start resizing
            initialWidth = element.offsetWidth;
            initialHeight = element.offsetHeight;
        } else {
            isDragging = true;
        }
        
        currentX = e.clientX;
        currentY = e.clientY;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault(); // Prevent text selection while dragging
    }
    
    function onMouseMove(e) {
        if (isDragging) {
            const deltaX = e.clientX - currentX;
            const deltaY = e.clientY - currentY;
            
            const container = document.getElementById('canvasContainer');
            const containerRect = container.getBoundingClientRect();
            
            let newLeft = element.offsetLeft + deltaX;
            let newTop = element.offsetTop + deltaY;
            
            // Constrain to container bounds
            newLeft = Math.max(0, Math.min(newLeft, containerRect.width - element.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, containerRect.height - element.offsetHeight));
            
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
            
            currentX = e.clientX;
            currentY = e.clientY;
        } else if (isResizing) {
            const deltaX = e.clientX - currentX;
            const deltaY = e.clientY - currentY;
            
            // Calculate new dimensions based on the current mouse position
            const newWidth = Math.max(100, initialWidth + (e.clientX - currentX));
            const newHeight = Math.max(40, initialHeight + (e.clientY - currentY));
            
            // Update element dimensions
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
            
            // Store the dimensions in the dataset
            element.dataset.width = newWidth;
            element.dataset.height = newHeight;
            
            // Update text box preview with new dimensions
            updateTextBoxPreview(element);
        }
    }
    
    function onMouseUp() {
        isDragging = false;
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        // Store final dimensions in the dataset
        if (element.offsetWidth > 0 && element.offsetHeight > 0) {
            element.dataset.width = element.offsetWidth;
            element.dataset.height = element.offsetHeight;
        }
    }
}

// Font size controls
document.getElementById('increaseFontSize').addEventListener('click', () => {
    if (selectedTextBox) {
        const currentSize = parseInt(selectedTextBox.dataset.fontSize);
        const newSize = currentSize + 2;
        selectedTextBox.dataset.fontSize = newSize;
        selectedTextBox.style.fontSize = `${newSize}px`;
        document.getElementById('fontSize').value = newSize;
        updateTextBoxPreview(selectedTextBox);
    }
});

document.getElementById('decreaseFontSize').addEventListener('click', () => {
    if (selectedTextBox) {
        const currentSize = parseInt(selectedTextBox.dataset.fontSize);
        const newSize = Math.max(8, currentSize - 2);
        selectedTextBox.dataset.fontSize = newSize;
        selectedTextBox.style.fontSize = `${newSize}px`;
        document.getElementById('fontSize').value = newSize;
        updateTextBoxPreview(selectedTextBox);
    }
});

// Font style controls
document.getElementById('boldText').addEventListener('click', () => {
    if (selectedTextBox) {
        const isBold = selectedTextBox.dataset.bold === 'true';
        selectedTextBox.dataset.bold = (!isBold).toString();
        selectedTextBox.style.fontWeight = !isBold ? 'bold' : 'normal';
        document.getElementById('boldText').classList.toggle('active');
    }
});

document.getElementById('italicText').addEventListener('click', () => {
    if (selectedTextBox) {
        const isItalic = selectedTextBox.dataset.italic === 'true';
        selectedTextBox.dataset.italic = (!isItalic).toString();
        selectedTextBox.style.fontStyle = !isItalic ? 'italic' : 'normal';
        document.getElementById('italicText').classList.toggle('active');
    }
});

document.getElementById('underlineText').addEventListener('click', () => {
    if (selectedTextBox) {
        const isUnderline = selectedTextBox.dataset.underline === 'true';
        selectedTextBox.dataset.underline = (!isUnderline).toString();
        selectedTextBox.style.textDecoration = !isUnderline ? 'underline' : 'none';
        document.getElementById('underlineText').classList.toggle('active');
    }
});

// Text alignment controls
document.querySelectorAll('[data-align]').forEach(btn => {
    btn.addEventListener('click', () => {
        if (selectedTextBox) {
            const alignment = btn.dataset.align;
            selectedTextBox.dataset.align = alignment;
            selectedTextBox.style.textAlign = alignment;
            
            // Update button states
            document.querySelectorAll('[data-align]').forEach(b => {
                b.classList.toggle('active', b.dataset.align === alignment);
            });
        }
    });
});

// Font family control
document.getElementById('fontFamily').addEventListener('change', (e) => {
    if (selectedTextBox) {
        selectedTextBox.style.fontFamily = e.target.value;
        selectedTextBox.dataset.fontFamily = e.target.value;
    }
});

// Font size input
document.getElementById('fontSize').addEventListener('change', (e) => {
    if (selectedTextBox) {
        const newSize = parseInt(e.target.value);
        selectedTextBox.dataset.fontSize = newSize;
        selectedTextBox.style.fontSize = `${newSize}px`;
        updateTextBoxPreview(selectedTextBox);
    }
});

// Font color input
document.getElementById('fontColor').addEventListener('input', (e) => {
    if (selectedTextBox) {
        selectedTextBox.style.color = e.target.value;
        selectedTextBox.dataset.color = e.target.value;
    }
});

// Preview Images
document.getElementById('previewBtn').addEventListener('click', async () => {
    if (!currentTemplate || !csvData || textBoxes.length === 0) {
        alert('Please complete all steps before previewing images');
        return;
    }
    
    try {
        // Show loading state
        const previewBtn = document.getElementById('previewBtn');
        const originalText = previewBtn.textContent;
        previewBtn.textContent = 'Generating Previews...';
        previewBtn.disabled = true;
        
        const canvas = document.getElementById('templateCanvas');
        const scaleX = originalImageSize.width / canvas.width;
        const scaleY = originalImageSize.height / canvas.height;
        
        const textBoxConfigs = Array.from(document.querySelectorAll('.text-box')).map(box => {
            const scaledX = parseFloat((box.offsetLeft * scaleX).toFixed(2));
            const scaledY = parseFloat((box.offsetTop * scaleY).toFixed(2));
            const scaledFontSize = parseInt(box.dataset.fontSize) * Math.max(scaleX, scaleY);
            const scaledWidth = parseFloat((parseInt(box.dataset.width || box.offsetWidth) * scaleX).toFixed(2));
            const scaledHeight = parseFloat((parseInt(box.dataset.height || box.offsetHeight) * scaleY).toFixed(2));
            
            return {
                column: box.dataset.column,
                x: scaledX,
                y: scaledY,
                size: Math.round(scaledFontSize),
                color: box.dataset.color || '#000000',
                width: scaledWidth,
                height: scaledHeight,
                fontFamily: box.dataset.fontFamily || 'Arial',
                bold: box.dataset.bold === 'true',
                italic: box.dataset.italic === 'true',
                underline: box.dataset.underline === 'true',
                align: box.dataset.align || 'left'
            };
        });
        
        // Ensure CSV data is properly formatted
        const formattedCsvData = csvData.map(row => {
            const formattedRow = {};
            for (const key in row) {
                formattedRow[key] = String(row[key] || '').trim();
            }
            return formattedRow;
        });
        
        const response = await fetch('/preview_images', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                template: currentTemplate,
                csv_data: formattedCsvData,
                text_boxes: textBoxConfigs
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            // Store preview URLs for download
            window.previewUrls = data.preview_urls;
            
            // Update carousel with preview images
            const carousel = document.getElementById('previewCarousel');
            const carouselInner = carousel.querySelector('.carousel-inner');
            const indicators = carousel.querySelector('.carousel-indicators');
            
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
            
            carousel.classList.remove('d-none');
            
            // Enable download button if we have previews
            const downloadBtn = document.getElementById('downloadPreviewBtn');
            downloadBtn.disabled = false;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('Preview error:', error);
        alert('Error generating previews: ' + error.message);
    } finally {
        // Reset preview button state
        const previewBtn = document.getElementById('previewBtn');
        previewBtn.textContent = originalText;
        previewBtn.disabled = false;
    }
});

// Download Preview Images
document.getElementById('downloadPreviewBtn').addEventListener('click', async () => {
    if (!window.previewUrls || window.previewUrls.length === 0) {
        alert('No preview images available to download. Please generate previews first.');
        return;
    }

    try {
        // Show loading state
        const downloadBtn = document.getElementById('downloadPreviewBtn');
        const originalText = downloadBtn.textContent;
        downloadBtn.textContent = 'Preparing Download...';
        downloadBtn.disabled = true;

        // Create a zip file containing all preview images
        const response = await fetch('/download_previews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                preview_urls: window.previewUrls
            })
        });

        if (response.ok) {
            // Create a blob from the response and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'preview_images.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to download preview images');
        }
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading preview images: ' + error.message);
    } finally {
        // Reset download button state
        const downloadBtn = document.getElementById('downloadPreviewBtn');
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
    }
});

function updateTextBoxPreview(textBox) {
    const column = textBox.dataset.column;
    if (csvData && csvData.length > 0 && column in csvData[0]) {
        const previewText = csvData[0][column];
        
        // Check if text box content elements exist
        let headerDiv = textBox.querySelector('.text-box-header');
        let contentDiv = textBox.querySelector('.text-box-content');
        let resizeHandle = textBox.querySelector('.resize-handle');
        let contentWrapper = textBox.querySelector('.text-box-content-wrapper');
        
        // Create elements if they don't exist
        if (!headerDiv) {
            headerDiv = document.createElement('div');
            headerDiv.className = 'text-box-header';
            textBox.appendChild(headerDiv);
        }
        
        if (!contentWrapper) {
            contentWrapper = document.createElement('div');
            contentWrapper.className = 'text-box-content-wrapper';
            textBox.appendChild(contentWrapper);
        }
        
        if (!contentDiv) {
            contentDiv = document.createElement('div');
            contentDiv.className = 'text-box-content';
            contentWrapper.appendChild(contentDiv);
        } else if (contentDiv.parentElement !== contentWrapper) {
            contentWrapper.appendChild(contentDiv);
        }
        
        // Create resize handle if it doesn't exist
        if (!resizeHandle) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            textBox.appendChild(resizeHandle);
        }
        
        // Update content
        headerDiv.textContent = column;
        contentDiv.textContent = previewText;
        
        // Apply text wrapping styles to content div
        contentDiv.style.wordWrap = 'break-word';
        contentDiv.style.overflowWrap = 'break-word';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.width = '100%';
        
        // Apply wrapper styles
        contentWrapper.style.flex = '1';
        contentWrapper.style.overflow = 'hidden';
        contentWrapper.style.width = '100%';
        contentWrapper.style.position = 'relative';
        
        // Apply container styles
        textBox.style.display = 'flex';
        textBox.style.flexDirection = 'column';
        textBox.style.position = 'absolute';
        textBox.style.padding = '5px';
        textBox.style.boxSizing = 'border-box';
        textBox.style.overflow = 'hidden';
    }
} 