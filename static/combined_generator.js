document.addEventListener('DOMContentLoaded', () => {
    // Add CSS for boxes styling
    const style = document.createElement('style');
    style.textContent = `
        .combined-box {
            position: absolute;
            background-color: rgba(200, 200, 200, 0.2);
            padding: 5px;
            box-sizing: border-box;
            cursor: move;
        }
        
        .combined-text-box {
            border: 2px dashed #007bff;
        }
        
        .combined-image-box {
            border: 2px dashed #28a745;
        }
        
        .combined-box.selected {
            border: 2px solid #0275d8;
            background-color: rgba(2, 117, 216, 0.1);
            z-index: 1000;
        }
        
        .resize-handle {
            position: absolute;
            width: 12px;
            height: 12px;
            bottom: 0;
            right: 0;
            background-color: #0275d8;
            cursor: nwse-resize;
        }
        
        .box-header {
            background-color: rgba(0, 0, 0, 0.1);
            padding: 2px 5px;
            font-size: 12px;
            margin-bottom: 5px;
            user-select: none;
        }
        
        .placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #666;
            font-style: italic;
        }
        
        #combinedCanvasContainer {
            position: relative;
            overflow: hidden;
            margin: 0 auto;
        }
        
        #combinedPreviewCarousel {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .box-delete-btn {
            position: absolute;
            right: 2px;
            top: 2px;
            width: 16px;
            height: 16px;
            font-size: 10px;
            line-height: 14px;
            text-align: center;
            background-color: #ff4444;
            color: white;
            border-radius: 50%;
            cursor: pointer;
            z-index: 10;
        }
        
        .preview-image-container {
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            max-width: 100%;
            margin: 0 auto;
        }
        
        #combinedSinglePreview {
            max-width: 100%;
            object-fit: contain;
        }
        
        .progress-container {
            margin: 10px 0;
            background-color: #f1f1f1;
            border-radius: 8px;
            height: 20px;
            position: relative;
            overflow: hidden;
            display: none;
        }
        
        .progress-bar {
            height: 100%;
            background-color: #4CAF50;
            width: 0%;
            transition: width 0.3s ease;
            text-align: center;
            line-height: 20px;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }
        
        /* Add indeterminate progress animation */
        @keyframes progress-animation {
            0% { width: 0%; background-color: #4CAF50; }
            20% { width: 20%; background-color: #4CAF50; }
            40% { width: 40%; background-color: #78c379; }
            60% { width: 60%; background-color: #8FBC8F; }
            80% { width: 80%; background-color: #78c379; }
            100% { width: 0%; background-color: #4CAF50; }
        }
        
        .progress-bar.indeterminate {
            width: 100%;
            background: linear-gradient(to right, #4CAF50, #8FBC8F, #4CAF50);
            background-size: 200% 100%;
            animation: progress-animation 2s infinite;
        }
        
        .progress-text {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #333;
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);

    // State variables
    let currentTemplate = null;
    let csvData = null;
    let originalImageSize = { width: 0, height: 0 };
    let boxes = [];
    let selectedBox = null;

    // Helper function for error display
    function displayStatus(message, isError = false) {
        const statusDiv = document.getElementById('combinedStatus');
        statusDiv.textContent = message;
        statusDiv.className = isError ? 'mt-3 text-danger' : 'mt-3 text-success';
        if (isError) {
            console.error(message);
            alert(message);
        }
    }

    // Progress bar functions
    function showProgressBar(containerId = 'combinedProgressContainer', indeterminate = true) {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'block';
            const bar = container.querySelector('.progress-bar');
            const text = container.querySelector('.progress-text');
            
            if (indeterminate) {
                // Start with indeterminate animation
                if (bar) {
                    bar.classList.add('indeterminate');
                    bar.style.width = '100%';
                }
                if (text) {
                    text.textContent = 'Processing...';
                }
            } else {
                // Or start with 0% if not indeterminate
                updateProgress(0, containerId);
            }
        }
    }

    function hideProgressBar(containerId = 'combinedProgressContainer') {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = 'none';
        }
    }

    function updateProgress(percent, containerId = 'combinedProgressContainer') {
        const container = document.getElementById(containerId);
        if (container) {
            const bar = container.querySelector('.progress-bar');
            const text = container.querySelector('.progress-text');
            
            // If we have a real percentage now, remove indeterminate styling
            if (percent > 0 && bar && bar.classList.contains('indeterminate')) {
                bar.classList.remove('indeterminate');
            }
            
            // Cap progress at 95% until explicitly set to 100%
            // This ensures we don't show "complete" until it's really done
            let displayPercent = percent;
            if (percent > 0 && percent < 100) {
                // Scale percentage to max 95% until we get the final 100%
                displayPercent = Math.min(95, percent);
            }
            
            if (bar) {
                bar.style.width = `${displayPercent}%`;
            }
            
            if (text) {
                if (percent === 0 && bar && bar.classList.contains('indeterminate')) {
                    text.textContent = 'Processing...';
                } else if (percent < 100) {
                    text.textContent = `${Math.round(displayPercent)}%`;
                } else {
                    text.textContent = 'Complete';
                }
            }
        }
    }

    // Template Upload
    const templateForm = document.getElementById('combinedTemplateForm');
    if (templateForm) {
        templateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('combinedTemplate');
            
            const file = fileInput.files[0];
            if (!file) {
                displayStatus('Please select an image file to upload', true);
                return;
            }
            
            if (!file.type.match('image.*')) {
                displayStatus('Please select a valid image file (JPEG, PNG, etc.)', true);
                return;
            }
            
            const formData = new FormData();
            formData.append('template', file);

            try {
                const response = await fetch('/upload_template', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Upload failed');
                }
                
                const data = await response.json();
                
                currentTemplate = data.filename;
                const previewImage = document.getElementById('combinedPreview');
                if (previewImage) {
                    previewImage.src = data.image_url;
                    previewImage.classList.remove('d-none');
                }
                
                // Initialize canvas with the image
                initializeCanvas(data.image_url);
                
                displayStatus('Template uploaded successfully');
            } catch (error) {
                displayStatus('Error uploading template: ' + error.message, true);
            }
        });
    }

    function initializeCanvas(imageUrl) {
        const canvas = document.getElementById('combinedTemplateCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    originalImageSize.width = img.width;
                    originalImageSize.height = img.height;
                    
                    const maxWidth = 800;
                    const maxHeight = 600;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth || height > maxHeight) {
                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                        width = width * ratio;
                        height = height * ratio;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    const boxesContainer = document.getElementById('combinedBoxes');
                    if (boxesContainer) {
                        boxesContainer.innerHTML = '';
                    }
                    boxes = [];
                    selectedBox = null;
                    
                    const container = document.getElementById('combinedCanvasContainer');
                    if (container) {
                        container.style.width = width + 'px';
                        container.style.height = height + 'px';
                    }
                    
                    // Store the canvas dimensions to use for preview
                    window.templateDimensions = { width, height };
                } catch (error) {
                    displayStatus('Error processing image: ' + error.message, true);
                }
            };
            
            img.onerror = () => {
                displayStatus('Failed to load image', true);
            };
            
            if (imageUrl.startsWith('data:')) {
                img.src = imageUrl;
            } else {
                img.src = imageUrl + '?t=' + new Date().getTime();
            }
        }
    }

    // CSV Upload
    document.getElementById('combinedCsvForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('combinedCsv').files[0];
        if (!file) {
            displayStatus('Please select a file to upload', true);
            return;
        }

        // Validate file type
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            displayStatus('Please upload a CSV or Excel file', true);
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
            window.fullCsvData = data.all_data;
            updateCsvPreview(data.columns, data.preview);
            updateColumnSelects(data.columns);
            
            displayStatus('CSV data uploaded successfully');
        } catch (error) {
            displayStatus('Error uploading file: ' + error.message, true);
        }
    });

    function updateCsvPreview(columns, data) {
        const headers = document.getElementById('combinedCsvHeaders');
        const tbody = document.getElementById('combinedCsvData');
        
        headers.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;
        
        tbody.innerHTML = data.map(row => 
            `<tr>${columns.map(col => `<td>${row[col]}</td>`).join('')}</tr>`
        ).join('');
    }

    function updateColumnSelects(columns) {
        // Update both text and image column selects
        const textColumnSelect = document.getElementById('combinedTextColumnSelect');
        const imageColumnSelect = document.getElementById('combinedImageColumnSelect');
        
        textColumnSelect.innerHTML = columns.map(col => 
            `<option value="${col}">${col}</option>`
        ).join('');
        
        imageColumnSelect.innerHTML = columns.map(col => 
            `<option value="${col}">${col}</option>`
        ).join('');
    }

    // Box Management Base Functions
    function makeDraggableAndResizable(element) {
        let isDragging = false;
        let isResizing = false;
        let currentX;
        let currentY;
        let initialWidth;
        let initialHeight;
        
        // Use the element itself for dragging, not a header
        element.addEventListener('mousedown', (e) => {
            // Prevent dragging if clicking on the resize handle
            if (e.target.classList.contains('resize-handle')) {
                return;
            }
            isDragging = true;
            currentX = e.clientX;
            currentY = e.clientY;
            e.preventDefault();
            selectBox(element);
        });
        
        const resizeHandle = element.querySelector('.resize-handle');
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            currentX = e.clientX;
            currentY = e.clientY;
            initialWidth = element.offsetWidth;
            initialHeight = element.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
            selectBox(element);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - currentX;
                const deltaY = e.clientY - currentY;
                
                const container = document.getElementById('combinedCanvasContainer');
                const containerRect = container.getBoundingClientRect();
                
                let newLeft = element.offsetLeft + deltaX;
                let newTop = element.offsetTop + deltaY;
                
                // Constrain to container
                newLeft = Math.max(0, Math.min(newLeft, containerRect.width - element.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, containerRect.height - element.offsetHeight));
                
                // Ensure we set the style with px to make it a valid CSS value
                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
                
                currentX = e.clientX;
                currentY = e.clientY;
            } else if (isResizing) {
                const newWidth = Math.max(100, initialWidth + (e.clientX - currentX));
                const newHeight = Math.max(50, initialHeight + (e.clientY - currentY));
                
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
                
                // Update the dataset values without 'px' suffix
                element.dataset.width = newWidth.toString();
                element.dataset.height = newHeight.toString();
                
                updateBoxPreview(element);
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging || isResizing) {
                isDragging = false;
                isResizing = false;
                
                // Store dimensions
                if (element.offsetWidth > 0 && element.offsetHeight > 0) {
                    element.dataset.width = element.offsetWidth;
                    element.dataset.height = element.offsetHeight;
                }
            }
        });
        
        // Add delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'box-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Delete box';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            element.remove();
            boxes = boxes.filter(box => box !== element);
            if (selectedBox === element) {
                selectedBox = null;
            }
        });
        
        element.appendChild(deleteBtn);
        
        // Make box selectable
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            selectBox(element);
        });
    }

    function selectBox(box) {
        if (selectedBox) {
            selectedBox.classList.remove('selected');
        }
        selectedBox = box;
        box.classList.add('selected');
        
        // Update form controls based on box type and properties
        if (box.classList.contains('combined-text-box')) {
            document.getElementById('text-box-tab').click();
            document.getElementById('combinedTextColumnSelect').value = box.dataset.column;
            document.getElementById('combinedFontSize').value = box.dataset.fontSize;
            document.getElementById('combinedFontColor').value = box.dataset.color;
            document.getElementById('combinedFontFamily').value = box.dataset.fontFamily;
            
            // Update style buttons
            document.getElementById('combinedBoldText').classList.toggle('active', box.dataset.bold === 'true');
            document.getElementById('combinedItalicText').classList.toggle('active', box.dataset.italic === 'true');
            document.getElementById('combinedUnderlineText').classList.toggle('active', box.dataset.underline === 'true');
            document.getElementById('combinedStrikethroughText').classList.toggle('active', box.dataset.strikethrough === 'true');
            
            // Update alignment buttons
            document.querySelectorAll('[data-align]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === box.dataset.align);
            });
        } else if (box.classList.contains('combined-image-box')) {
            document.getElementById('image-box-tab').click();
            document.getElementById('combinedImageColumnSelect').value = box.dataset.column;
        }
    }

    // Text Box Functions
    document.getElementById('addCombinedTextBox').addEventListener('click', () => {
        if (!csvData || csvData.length === 0) {
            displayStatus('Please upload CSV data first', true);
            return;
        }
        
        const column = document.getElementById('combinedTextColumnSelect').value;
        const fontSize = document.getElementById('combinedFontSize').value;
        const color = document.getElementById('combinedFontColor').value;
        const fontFamily = document.getElementById('combinedFontFamily').value;
        
        const textBox = document.createElement('div');
        textBox.className = 'combined-box combined-text-box';
        
        // Remove padding at the top to fix alignment issues
        textBox.style.padding = '0';
        textBox.style.fontSize = `${fontSize}px`;
        textBox.style.color = color;
        textBox.style.fontFamily = fontFamily;
        textBox.style.width = '150px';
        textBox.style.height = '60px';
        textBox.style.boxSizing = 'border-box';
        textBox.style.display = 'flex';
        textBox.style.overflow = 'hidden';
        
        textBox.dataset.column = column;
        textBox.dataset.fontSize = fontSize;
        textBox.dataset.color = color;
        textBox.dataset.fontFamily = fontFamily;
        textBox.dataset.bold = 'false';
        textBox.dataset.italic = 'false';
        textBox.dataset.underline = 'false';
        textBox.dataset.strikethrough = 'false';
        textBox.dataset.align = 'left';
        textBox.dataset.width = '150';
        textBox.dataset.height = '60';
        textBox.dataset.type = 'text';
        
        // Create content wrapper (adjust styling if needed)
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'box-content-wrapper';
        contentWrapper.style.width = '100%'; // Take full width
        contentWrapper.style.height = '100%'; // Take full height
        contentWrapper.style.overflow = 'hidden';
        contentWrapper.style.display = 'flex'; // Use flex to align content
        contentWrapper.style.alignItems = 'center'; // Center content vertically
        contentWrapper.style.justifyContent = 'center'; // Center content horizontally
        textBox.appendChild(contentWrapper);

        // Create content div
        const contentDiv = document.createElement('div');
        contentDiv.className = 'box-content';
        contentDiv.style.wordWrap = 'break-word';
        contentDiv.style.overflowWrap = 'break-word';
        contentDiv.style.whiteSpace = 'pre-wrap';
        contentDiv.style.width = '100%';
        contentDiv.style.textAlign = 'center'; // Center text by default
        contentDiv.style.padding = '0';
        contentDiv.style.margin = '0';
        contentDiv.style.lineHeight = '1.2'; // Slightly increase line height for better readability
        contentWrapper.appendChild(contentDiv);
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        textBox.appendChild(resizeHandle);
        
        const container = document.getElementById('combinedCanvasContainer');
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2 - 75;  // Center horizontally
        const centerY = rect.height / 2 - 30; // Center vertically
        
        // Set position with explicit px values
        textBox.style.left = `${centerX}px`;
        textBox.style.top = `${centerY}px`;
        
        makeDraggableAndResizable(textBox);
        document.getElementById('combinedBoxes').appendChild(textBox);
        boxes.push(textBox);
        selectBox(textBox);
        updateBoxPreview(textBox);
    });

    // Image Box
    document.getElementById('addCombinedImageBox').addEventListener('click', () => {
        if (!csvData || csvData.length === 0) {
            displayStatus('Please upload CSV data first', true);
            return;
        }
        
        const column = document.getElementById('combinedImageColumnSelect').value;
        
        const imageBox = document.createElement('div');
        imageBox.className = 'combined-box combined-image-box';
        imageBox.style.width = '200px';
        imageBox.style.height = '200px';
        // Remove all padding completely
        imageBox.style.padding = '0';
        imageBox.style.boxSizing = 'border-box';
        imageBox.style.display = 'flex';
        imageBox.style.overflow = 'hidden';
        
        imageBox.dataset.column = column;
        imageBox.dataset.width = '200';
        imageBox.dataset.height = '200';
        imageBox.dataset.type = 'image';

        // Create content wrapper with flex alignment to match text boxes
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'box-content-wrapper';
        contentWrapper.style.width = '100%';
        contentWrapper.style.height = '100%';
        contentWrapper.style.overflow = 'hidden';
        contentWrapper.style.display = 'flex';
        contentWrapper.style.alignItems = 'center'; // Center vertically
        contentWrapper.style.justifyContent = 'center'; // Center horizontally
        imageBox.appendChild(contentWrapper);
        
        // Create content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'box-content';
        contentDiv.style.width = '100%';
        contentDiv.style.height = '100%';
        contentDiv.style.display = 'flex';
        contentDiv.style.alignItems = 'center';
        contentDiv.style.justifyContent = 'center';
        contentDiv.style.padding = '0';
        contentDiv.style.margin = '0';
        contentDiv.innerHTML = '<div class="placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Image Placeholder</div>';
        contentWrapper.appendChild(contentDiv);
        
        // Add resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        imageBox.appendChild(resizeHandle);
        
        // Position in the center of the canvas container
        const container = document.getElementById('combinedCanvasContainer');
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2 - 100;  // Center horizontally
        const centerY = rect.height / 2 - 100; // Center vertically
        
        // Set position with explicit px values
        imageBox.style.left = `${centerX}px`;
        imageBox.style.top = `${centerY}px`;
        
        makeDraggableAndResizable(imageBox);
        document.getElementById('combinedBoxes').appendChild(imageBox);
        boxes.push(imageBox);
        selectBox(imageBox);
        updateBoxPreview(imageBox);
    });

    // Box Preview Updates
    function updateBoxPreview(box) {
        if (!csvData || csvData.length === 0) return;
        
        const column = box.dataset.column;
        const boxType = box.dataset.type;
        
        if (column in csvData[0]) {
            const previewValue = csvData[0][column];
            const contentDiv = box.querySelector('.box-content');
            
            if (boxType === 'text') {
                // Update text styling
                contentDiv.style.fontSize = box.dataset.fontSize + 'px';
                contentDiv.style.color = box.dataset.color;
                contentDiv.style.fontFamily = box.dataset.fontFamily;
                contentDiv.style.fontWeight = box.dataset.bold === 'true' ? 'bold' : 'normal';
                contentDiv.style.fontStyle = box.dataset.italic === 'true' ? 'italic' : 'normal';
                
                // Handle both underline and strikethrough
                let textDecoration = [];
                if (box.dataset.underline === 'true') textDecoration.push('underline');
                if (box.dataset.strikethrough === 'true') textDecoration.push('line-through');
                contentDiv.style.textDecoration = textDecoration.length ? textDecoration.join(' ') : 'none';
                
                // Set text alignment
                const textAlign = box.dataset.align || 'left';
                contentDiv.style.textAlign = textAlign;
                
                contentDiv.style.padding = '0'; // Ensure no padding
                contentDiv.style.margin = '0'; // Ensure no margin
                contentDiv.style.lineHeight = '1.2'; // Consistent line height
                
                contentDiv.textContent = previewValue || 'Text Preview';
            } else if (boxType === 'image') {
                if (previewValue) {
                    contentDiv.innerHTML = `
                        <div class="image-preview" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0;">
                            <img src="${previewValue}" style="max-width: 100%; max-height: 100%; object-fit: contain;" 
                                onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='Invalid Image URL';">
                        </div>`;
                } else {
                    contentDiv.innerHTML = '<div class="placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:0;margin:0;">Image Placeholder</div>';
                }
            }
        }
    }

    // Font style controls
    document.getElementById('combinedBoldText').addEventListener('click', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const isBold = selectedBox.dataset.bold === 'true';
        selectedBox.dataset.bold = (!isBold).toString();
        this.classList.toggle('active', !isBold);
        updateBoxPreview(selectedBox);
    });

    document.getElementById('combinedItalicText').addEventListener('click', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const isItalic = selectedBox.dataset.italic === 'true';
        selectedBox.dataset.italic = (!isItalic).toString();
        this.classList.toggle('active', !isItalic);
        updateBoxPreview(selectedBox);
    });

    document.getElementById('combinedUnderlineText').addEventListener('click', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const isUnderline = selectedBox.dataset.underline === 'true';
        selectedBox.dataset.underline = (!isUnderline).toString();
        this.classList.toggle('active', !isUnderline);
        updateBoxPreview(selectedBox);
    });

    document.getElementById('combinedStrikethroughText').addEventListener('click', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const isStrikethrough = selectedBox.dataset.strikethrough === 'true';
        selectedBox.dataset.strikethrough = (!isStrikethrough).toString();
        this.classList.toggle('active', !isStrikethrough);
        updateBoxPreview(selectedBox);
    });

    // Font size controls
    document.getElementById('combinedIncreaseFontSize').addEventListener('click', () => {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const currentSize = parseInt(selectedBox.dataset.fontSize);
        const newSize = Math.min(currentSize + 2, 200);
        selectedBox.dataset.fontSize = newSize;
        document.getElementById('combinedFontSize').value = newSize;
        updateBoxPreview(selectedBox);
    });

    document.getElementById('combinedDecreaseFontSize').addEventListener('click', () => {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        const currentSize = parseInt(selectedBox.dataset.fontSize);
        const newSize = Math.max(currentSize - 2, 8);
        selectedBox.dataset.fontSize = newSize;
        document.getElementById('combinedFontSize').value = newSize;
        updateBoxPreview(selectedBox);
    });

    // Font size direct input
    document.getElementById('combinedFontSize').addEventListener('change', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        let newSize = parseInt(this.value);
        if (newSize < 8) newSize = 8;
        if (newSize > 200) newSize = 200;
        this.value = newSize;
        selectedBox.dataset.fontSize = newSize;
        updateBoxPreview(selectedBox);
    });

    // Font color
    document.getElementById('combinedFontColor').addEventListener('change', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        selectedBox.dataset.color = this.value;
        updateBoxPreview(selectedBox);
    });

    // Font family
    document.getElementById('combinedFontFamily').addEventListener('change', function() {
        if (!selectedBox || selectedBox.dataset.type !== 'text') return;
        
        selectedBox.dataset.fontFamily = this.value;
        updateBoxPreview(selectedBox);
    });

    // Text alignment
    document.querySelectorAll('[id^="combinedAlign"]').forEach(button => {
        button.addEventListener('click', function() {
            if (!selectedBox || selectedBox.dataset.type !== 'text') return;
            
            const align = this.dataset.align;
            selectedBox.dataset.align = align;
            
            // Update all alignment buttons' active state
            document.querySelectorAll('[id^="combinedAlign"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.align === align);
            });
            
            // Update the text box alignment immediately
            const contentDiv = selectedBox.querySelector('.box-content');
            if (contentDiv) {
                contentDiv.style.textAlign = align;
            }
            
            updateBoxPreview(selectedBox);
        });
    });

    // Preview and Download
    document.getElementById('combinedPreviewBtn').addEventListener('click', async () => {
        if (!currentTemplate || !csvData || boxes.length === 0) {
            displayStatus('Please complete all steps before previewing images', true);
            return;
        }

        const previewBtn = document.getElementById('combinedPreviewBtn');
        const originalText = previewBtn.textContent;

        try {
            previewBtn.textContent = 'Generating Previews...';
            previewBtn.disabled = true;
            showProgressBar('combinedProgressContainer', true);

            const canvas = document.getElementById('combinedTemplateCanvas');
            const scaleX = originalImageSize.width / canvas.width;
            const scaleY = originalImageSize.height / canvas.height;

            const boxConfigs = Array.from(document.querySelectorAll('.combined-box')).map(box => {
                const boxType = box.dataset.type;
                const container = document.getElementById('combinedCanvasContainer');
                
                // Get position and size directly from the box's styles
                const left = parseInt(box.style.left) || box.offsetLeft;
                const top = parseInt(box.style.top) || box.offsetTop;
                const width = parseInt(box.dataset.width) || box.offsetWidth;
                const height = parseInt(box.dataset.height) || box.offsetHeight;
                
                // Scale positions and dimensions to match original image size
                const scaledX = parseFloat((left * scaleX).toFixed(2));
                const scaledY = parseFloat((top * scaleY).toFixed(2));
                const scaledWidth = parseFloat((width * scaleX).toFixed(2));
                const scaledHeight = parseFloat((height * scaleY).toFixed(2));
                
                // Base config with shared properties
                const config = {
                    column: box.dataset.column,
                    x: scaledX,
                    y: scaledY,
                    width: scaledWidth,
                    height: scaledHeight
                };
                
                // Add specific properties based on box type
                if (boxType === 'text') {
                    config.fontSize = parseInt(box.dataset.fontSize) * scaleX; // Scale font size
                    config.color = box.dataset.color;
                    config.fontFamily = box.dataset.fontFamily;
                    config.bold = box.dataset.bold === 'true';
                    config.italic = box.dataset.italic === 'true';
                    config.underline = box.dataset.underline === 'true';
                    config.strikethrough = box.dataset.strikethrough === 'true';
                    config.align = box.dataset.align;
                } else if (boxType === 'image') {
                    config.isImage = true;
                }
                
                return config;
            });

            const formattedCsvData = window.fullCsvData || csvData;
            const totalRecords = formattedCsvData.length;

            // For faster preview generation, only request the first row's preview initially
            const firstRowData = [formattedCsvData[0]];

            // Function to poll progress
            const checkProgress = async () => {
                try {
                    const progressResponse = await fetch('/preview_progress');
                    if (progressResponse.ok) {
                        const progressData = await progressResponse.json();
                        updateProgress(progressData.percent, 'combinedProgressContainer');
                        
                        if (progressData.percent < 100) {
                            setTimeout(checkProgress, 500); // Poll every 500ms
                        }
                    }
                } catch (error) {
                    console.error('Error checking progress:', error);
                }
            };

            // Start progress polling
            setTimeout(checkProgress, 500);

            const response = await fetch('/preview_combined_images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    template: currentTemplate,
                    csv_data: firstRowData,
                    text_boxes: boxConfigs
                })
            });

            const data = await response.json();
            if (response.ok) {
                // Store all CSV data for on-demand preview generation
                window.allCsvData = formattedCsvData;
                window.previewBoxConfigs = boxConfigs;
                window.currentTemplateFile = currentTemplate;

                // Store first preview URL and show it
                window.previewUrls = data.preview_urls;
                window.currentPreviewIndex = 0;
                window.totalRecords = formattedCsvData.length;

                // Hide the carousel and show the single preview container
                const carousel = document.getElementById('combinedPreviewCarousel');
                carousel.classList.add('d-none');

                const previewContainer = document.getElementById('combinedPreviewContainer');
                previewContainer.classList.remove('d-none');

                // Update the preview image
                const singlePreview = document.getElementById('combinedSinglePreview');
                singlePreview.src = data.preview_urls[0];

                // Set preview image dimensions to match template
                if (window.templateDimensions) {
                    singlePreview.style.width = window.templateDimensions.width + 'px';
                    singlePreview.style.height = window.templateDimensions.height + 'px';
                    singlePreview.style.objectFit = 'contain';

                    // Make the preview container match template aspect ratio
                    const previewImageContainer = previewContainer.querySelector('.preview-image-container');
                    if (previewImageContainer) {
                        previewImageContainer.style.width = window.templateDimensions.width + 'px';
                        previewImageContainer.style.margin = '0 auto';
                    }
                }

                // Update the counter
                document.getElementById('totalImagesCount').textContent = formattedCsvData.length;
                document.getElementById('currentImageInput').value = 1;
                document.getElementById('currentImageInput').max = formattedCsvData.length;

                // Enable the download button
                const downloadBtn = document.getElementById('combinedDownloadBtn');
                downloadBtn.disabled = false;

                displayStatus(`Preview generated. Total records: ${formattedCsvData.length}`);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            displayStatus('Error generating previews: ' + error.message, true);
        } finally {
            previewBtn.textContent = originalText;
            previewBtn.disabled = false;
            hideProgressBar('combinedProgressContainer');
        }
    });
    
    // Navigation between previews
    document.getElementById('prevImageBtn').addEventListener('click', () => {
        navigatePreview(-1);
    });
    
    document.getElementById('nextImageBtn').addEventListener('click', () => {
        navigatePreview(1);
    });
    
    document.getElementById('currentImageInput').addEventListener('change', async function() {
        const recordNumber = parseInt(this.value);
        if (isNaN(recordNumber) || recordNumber < 1 || recordNumber > window.totalRecords) {
            this.value = window.currentPreviewIndex + 1;
            return;
        }
        
        await loadPreviewForRecord(recordNumber - 1);
    });
    
    async function navigatePreview(direction) {
        const newIndex = window.currentPreviewIndex + direction;
        if (newIndex < 0 || newIndex >= window.totalRecords) {
            return;
        }
        
        await loadPreviewForRecord(newIndex);
    }
    
    async function loadPreviewForRecord(index) {
        // If we already have this preview, just show it
        if (window.previewUrls[index]) {
            const singlePreview = document.getElementById('combinedSinglePreview');
            singlePreview.src = window.previewUrls[index];
            
            // Set preview image dimensions to match template
            if (window.templateDimensions) {
                singlePreview.style.width = window.templateDimensions.width + 'px';
                singlePreview.style.height = window.templateDimensions.height + 'px';
                singlePreview.style.objectFit = 'contain';
            }
            
            window.currentPreviewIndex = index;
            document.getElementById('currentImageInput').value = index + 1;
            return;
        }
        
        // Otherwise, generate it
        const statusDiv = document.getElementById('combinedStatus');
        const originalStatus = statusDiv.textContent;
        statusDiv.textContent = `Generating preview for record ${index + 1}...`;
        
        try {
            // Generate preview for the requested record
            const recordData = [window.allCsvData[index]];
            
            const response = await fetch('/preview_combined_images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    template: window.currentTemplateFile,
                    csv_data: recordData,
                    text_boxes: window.previewBoxConfigs
                })
            });
            
            const data = await response.json();
            if (response.ok) {
                // Store the preview URL
                window.previewUrls[index] = data.preview_urls[0];
                
                // Update the preview image
                const singlePreview = document.getElementById('combinedSinglePreview');
                singlePreview.src = data.preview_urls[0];
                
                // Set preview image dimensions to match template
                if (window.templateDimensions) {
                    singlePreview.style.width = window.templateDimensions.width + 'px';
                    singlePreview.style.height = window.templateDimensions.height + 'px';
                    singlePreview.style.objectFit = 'contain';
                }
                
                window.currentPreviewIndex = index;
                document.getElementById('currentImageInput').value = index + 1;
                
                statusDiv.textContent = `Showing record ${index + 1} of ${window.totalRecords}`;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            statusDiv.textContent = 'Error generating preview: ' + error.message;
            // Restore the previous value
            document.getElementById('currentImageInput').value = window.currentPreviewIndex + 1;
        }
    }

    // Download Images
    document.getElementById('combinedDownloadBtn').addEventListener('click', async () => {
        if (!window.currentTemplateFile || !window.allCsvData || !window.previewBoxConfigs) {
            displayStatus('No preview data available to download', true);
            return;
        }

        try {
            const downloadBtn = document.getElementById('combinedDownloadBtn');
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Preparing Download...';
            downloadBtn.disabled = true;
            displayStatus('Generating all images for download. This may take a moment...');
            showProgressBar('combinedDownloadProgress', true); // Start with indeterminate progress

            // Function to poll download progress
            const checkDownloadProgress = async () => {
                try {
                    const progressResponse = await fetch('/download_progress');
                    if (progressResponse.ok) {
                        const progressData = await progressResponse.json();
                        
                        // Scale down the progress - max 90% from server
                        // This leaves room for the final step (initiating download)
                        if (progressData.percent < 100) {
                            const scaledPercent = progressData.percent * 0.9; // Scale to max 90%
                            updateProgress(scaledPercent, 'combinedDownloadProgress');
                            setTimeout(checkDownloadProgress, 500); // Poll every 500ms
                        } else {
                            // Still don't show 100% - wait for actual download to start
                            updateProgress(95, 'combinedDownloadProgress');
                        }
                    }
                } catch (error) {
                    console.error('Error checking download progress:', error);
                }
            };

            // Start progress polling
            setTimeout(checkDownloadProgress, 500);

            // Generate all previews
            const response = await fetch('/preview_combined_images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    template: window.currentTemplateFile,
                    csv_data: window.allCsvData,
                    text_boxes: window.previewBoxConfigs
                })
            });

            let data;
            try {
                const responseText = await response.text(); // Get raw text first
                
                try {
                    // Try to parse as JSON
                    data = JSON.parse(responseText);
                } catch (jsonError) {
                    console.error('JSON parse error:', jsonError);
                    console.error('Response text:', responseText);
                    throw new Error(`Failed to parse server response as JSON: ${jsonError.message}`);
                }
                
                if (!response.ok) {
                    throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
                }

                if (!data.preview_urls || !Array.isArray(data.preview_urls)) {
                    console.error('Invalid response data:', data);
                    throw new Error('Server returned invalid data structure for preview URLs');
                }
                
                displayStatus(`Generated ${data.preview_urls.length} images. Preparing download...`);
                updateProgress(96, 'combinedDownloadProgress');
                
            } catch (error) {
                console.error('Error processing preview response:', error);
                throw error;
            }

            // Prepare images for individual download
            try {
                const prepareResponse = await fetch('/download_individual', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        preview_urls: data.preview_urls
                    })
                });

                let downloadData;
                try {
                    const prepareResponseText = await prepareResponse.text();
                    downloadData = JSON.parse(prepareResponseText);
                } catch (jsonError) {
                    console.error('Error parsing download response:', jsonError);
                    throw new Error(`Failed to parse download response: ${jsonError.message}`);
                }

                if (!prepareResponse.ok) {
                    throw new Error(downloadData.error || 'Failed to prepare images for download');
                }

                updateProgress(98, 'combinedDownloadProgress');
                
                // Short delay to show almost complete
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Only set to 100% right before initiating download
                updateProgress(100, 'combinedDownloadProgress');
                
                // Initiate direct download of the prepared zip file
                // Use both timestamp and unique_id in the URL
                const downloadUrl = `/download_batch/${downloadData.timestamp}/${downloadData.unique_id}`;
                window.location.href = downloadUrl;
                
                displayStatus(`Download initiated for ${downloadData.file_count} images.`);

                // Re-enable the button after a short delay to allow download to start
                setTimeout(() => {
                    const btn = document.getElementById('combinedDownloadBtn');
                    if (btn) {
                        // Use the originalText variable captured at the start
                        btn.textContent = originalText;
                        btn.disabled = false;
                        console.log('Download button re-enabled.');
                    }
                    // Keep progress bar visible for a moment after download starts
                    setTimeout(() => {
                        hideProgressBar('combinedDownloadProgress');
                    }, 2000);
                }, 1500); // Re-enable after 1.5 seconds

            } catch (error) {
                console.error('Error preparing images for download:', error);
                throw error;
            }

        } catch (error) {
            displayStatus('Error downloading preview images: ' + error.message, true);
            // Ensure button is re-enabled on error too
            const downloadBtn = document.getElementById('combinedDownloadBtn');
            if (downloadBtn) {
                 // Use originalText if available, otherwise default
                const originalText = downloadBtn.dataset.originalText || 'Download Images';
                downloadBtn.textContent = originalText;
                downloadBtn.disabled = false;
            }
            hideProgressBar('combinedDownloadProgress');
        } finally {
            // Keep the finally block as a safety net, but the setTimeout should handle the success case
            const downloadBtn = document.getElementById('combinedDownloadBtn');
             if (downloadBtn && downloadBtn.disabled) { // Only reset if still disabled
                 const originalText = downloadBtn.dataset.originalText || 'Download Images';
                 downloadBtn.textContent = originalText;
                 downloadBtn.disabled = false;
             }
        }
    });

    // Store original button text when the script loads
    const initialDownloadBtn = document.getElementById('combinedDownloadBtn');
    if(initialDownloadBtn) {
        initialDownloadBtn.dataset.originalText = initialDownloadBtn.textContent;
    }
}); 