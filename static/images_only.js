document.addEventListener('DOMContentLoaded', () => {
    // Add CSS for image box styling
    const style = document.createElement('style');
    style.textContent = `
        .image-box {
            position: absolute;
            border: 2px dashed #666;
            background-color: rgba(200, 200, 200, 0.2);
            padding: 5px;
            box-sizing: border-box;
            cursor: move;
        }
        
        .image-box.selected {
            border: 2px solid #0275d8;
            background-color: rgba(2, 117, 216, 0.1);
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
        
        .image-box-header {
            background-color: rgba(0, 0, 0, 0.1);
            padding: 2px 5px;
            font-size: 12px;
            margin-bottom: 5px;
        }
        
        .image-placeholder {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #666;
            font-style: italic;
        }
        
        #imageCanvasContainer {
            position: relative;
            overflow: hidden;
            margin: 0 auto;
        }
        
        #imagePreviewCarousel {
            max-width: 800px;
            margin: 0 auto;
        }
    `;
    document.head.appendChild(style);

    let currentTemplate = null;
    let csvData = null;
    let imageBoxes = [];
    let selectedImageBox = null;
    let originalImageSize = { width: 0, height: 0 };

    // Template Upload
    const templateForm = document.getElementById('imageTemplateForm');
    if (templateForm) {
        templateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = document.getElementById('imageTemplate');
            if (!fileInput) {
                console.error('Template file input not found');
                return;
            }
            
            const file = fileInput.files[0];
            if (!file) {
                alert('Please select an image file to upload');
                return;
            }
            
            if (!file.type.match('image.*')) {
                alert('Please select a valid image file (JPEG, PNG, etc.)');
                return;
            }
            
            const formData = new FormData();
            formData.append('template', file);

            try {
                const response = await fetch('/upload_image_template', {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    throw new Error('Upload failed');
                }
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                currentTemplate = data.filename;
                const previewImage = document.getElementById('imagePreview');
                if (previewImage) {
                    previewImage.src = data.image_url;
                    previewImage.classList.remove('d-none');
                }
                
                // Initialize canvas with the actual image
                const canvas = document.getElementById('imageTemplateCanvas');
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
                            
                            const imageBoxesContainer = document.getElementById('imageBoxes');
                            if (imageBoxesContainer) {
                                imageBoxesContainer.innerHTML = '';
                            }
                            imageBoxes = [];
                            selectedImageBox = null;
                            
                            const container = document.getElementById('imageCanvasContainer');
                            if (container) {
                                container.style.width = width + 'px';
                                container.style.height = height + 'px';
                            }
                        } catch (error) {
                            console.error('Error processing image:', error);
                            alert('Error processing image: ' + error.message);
                        }
                    };
                    
                    img.onerror = () => {
                        throw new Error('Failed to load image');
                    };
                    
                    if (data.image_url.startsWith('data:')) {
                        img.src = data.image_url;
                    } else {
                        img.src = data.image_url + '?t=' + new Date().getTime();
                    }
                }
                
            } catch (error) {
                console.error('Upload error:', error);
                alert('Error uploading template: ' + error.message);
            }
        });
    }

    // CSV Upload
    document.getElementById('imageCsvForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = document.getElementById('imageCsv').files[0];
        if (!file) {
            alert('Please select a file to upload');
            return;
        }

        // Validate file type
        const validExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            alert('Please upload a CSV or Excel file');
            return;
        }
        
        const formData = new FormData();
        formData.append('csv', file);

        try {
            const response = await fetch('/upload_image_csv', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Upload failed');
            }
            
            const data = await response.json();
            csvData = data.preview;
            updateImageCsvPreview(data.columns, data.preview);
            updateImageColumnSelect(data.columns);
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading file: ' + error.message);
        }
    });

    function updateImageCsvPreview(columns, data) {
        const headers = document.getElementById('imageCsvHeaders');
        const tbody = document.getElementById('imageCsvData');
        
        headers.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>`;
        
        tbody.innerHTML = data.map(row => 
            `<tr>${columns.map(col => `<td>${row[col]}</td>`).join('')}</tr>`
        ).join('');
    }

    function updateImageColumnSelect(columns) {
        const select = document.getElementById('imageColumnSelect');
        select.innerHTML = columns.map(col => 
            `<option value="${col}">${col}</option>`
        ).join('');
    }

    // Image Box Management
    document.getElementById('addImageBox').addEventListener('click', () => {
        const column = document.getElementById('imageColumnSelect').value;
        
        const imageBox = document.createElement('div');
        imageBox.className = 'image-box';
        imageBox.style.position = 'absolute';
        imageBox.style.border = '2px dashed #666';
        imageBox.style.backgroundColor = 'rgba(200, 200, 200, 0.2)';
        imageBox.style.width = '200px';
        imageBox.style.height = '200px';
        imageBox.style.padding = '5px';
        imageBox.style.boxSizing = 'border-box';
        imageBox.style.display = 'flex';
        imageBox.style.flexDirection = 'column';
        imageBox.style.overflow = 'hidden';
        
        imageBox.dataset.column = column;
        imageBox.dataset.width = '200';
        imageBox.dataset.height = '200';
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'image-box-header';
        headerDiv.textContent = column;
        imageBox.appendChild(headerDiv);
        
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'image-box-content-wrapper';
        contentWrapper.style.flex = '1';
        contentWrapper.style.overflow = 'hidden';
        contentWrapper.style.width = '100%';
        contentWrapper.style.position = 'relative';
        imageBox.appendChild(contentWrapper);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'image-box-content';
        contentDiv.innerHTML = '<div class="image-placeholder">Image Placeholder</div>';
        contentDiv.style.width = '100%';
        contentWrapper.appendChild(contentDiv);
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        imageBox.appendChild(resizeHandle);
        
        const container = document.getElementById('imageCanvasContainer');
        const rect = container.getBoundingClientRect();
        imageBox.style.left = `${rect.width / 2 - 100}px`;
        imageBox.style.top = `${rect.height / 2 - 100}px`;
        
        imageBox.addEventListener('click', (e) => {
            e.stopPropagation();
            selectImageBox(imageBox);
        });
        
        makeDraggableAndResizable(imageBox);
        document.getElementById('imageBoxes').appendChild(imageBox);
        imageBoxes.push(imageBox);
        selectImageBox(imageBox);
        updateImageBoxPreview(imageBox);
    });

    function selectImageBox(imageBox) {
        if (selectedImageBox) {
            selectedImageBox.classList.remove('selected');
        }
        selectedImageBox = imageBox;
        imageBox.classList.add('selected');
        
        document.getElementById('imageColumnSelect').value = imageBox.dataset.column;
    }

    function makeDraggableAndResizable(element) {
        let isDragging = false;
        let isResizing = false;
        let currentX;
        let currentY;
        let initialWidth;
        let initialHeight;
        
        element.addEventListener('mousedown', onMouseDown);
        
        function onMouseDown(e) {
            if (e.target.classList.contains('resize-handle')) {
                isResizing = true;
                initialWidth = element.offsetWidth;
                initialHeight = element.offsetHeight;
            } else {
                isDragging = true;
            }
            
            currentX = e.clientX;
            currentY = e.clientY;
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }
        
        function onMouseMove(e) {
            if (isDragging) {
                const deltaX = e.clientX - currentX;
                const deltaY = e.clientY - currentY;
                
                const container = document.getElementById('imageCanvasContainer');
                const containerRect = container.getBoundingClientRect();
                
                let newLeft = element.offsetLeft + deltaX;
                let newTop = element.offsetTop + deltaY;
                
                newLeft = Math.max(0, Math.min(newLeft, containerRect.width - element.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, containerRect.height - element.offsetHeight));
                
                element.style.left = `${newLeft}px`;
                element.style.top = `${newTop}px`;
                
                currentX = e.clientX;
                currentY = e.clientY;
            } else if (isResizing) {
                const newWidth = Math.max(100, initialWidth + (e.clientX - currentX));
                const newHeight = Math.max(100, initialHeight + (e.clientY - currentY));
                
                element.style.width = `${newWidth}px`;
                element.style.height = `${newHeight}px`;
                
                element.dataset.width = newWidth;
                element.dataset.height = newHeight;
                
                updateImageBoxPreview(element);
            }
        }
        
        function onMouseUp() {
            isDragging = false;
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            if (element.offsetWidth > 0 && element.offsetHeight > 0) {
                element.dataset.width = element.offsetWidth;
                element.dataset.height = element.offsetHeight;
            }
        }
    }

    function updateImageBoxPreview(imageBox) {
        const column = imageBox.dataset.column;
        if (csvData && csvData.length > 0 && column in csvData[0]) {
            const previewValue = csvData[0][column];
            
            let headerDiv = imageBox.querySelector('.image-box-header');
            let contentDiv = imageBox.querySelector('.image-box-content');
            let resizeHandle = imageBox.querySelector('.resize-handle');
            let contentWrapper = imageBox.querySelector('.image-box-content-wrapper');
            
            if (!headerDiv) {
                headerDiv = document.createElement('div');
                headerDiv.className = 'image-box-header';
                imageBox.appendChild(headerDiv);
            }
            
            if (!contentWrapper) {
                contentWrapper = document.createElement('div');
                contentWrapper.className = 'image-box-content-wrapper';
                imageBox.appendChild(contentWrapper);
            }
            
            if (!contentDiv) {
                contentDiv = document.createElement('div');
                contentDiv.className = 'image-box-content';
                contentWrapper.appendChild(contentDiv);
            } else if (contentDiv.parentElement !== contentWrapper) {
                contentWrapper.appendChild(contentDiv);
            }
            
            if (!resizeHandle) {
                resizeHandle = document.createElement('div');
                resizeHandle.className = 'resize-handle';
                imageBox.appendChild(resizeHandle);
            }
            
            headerDiv.textContent = column;
            
            if (previewValue) {
                contentDiv.innerHTML = `
                    <div class="image-preview" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                        <img src="${previewValue}" style="max-width: 100%; max-height: 100%; object-fit: contain;" 
                             onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='Invalid Image URL';">
                    </div>`;
            } else {
                contentDiv.innerHTML = '<div class="image-placeholder">Image Placeholder</div>';
            }
            
            contentWrapper.style.flex = '1';
            contentWrapper.style.overflow = 'hidden';
            contentWrapper.style.width = '100%';
            contentWrapper.style.position = 'relative';
            
            imageBox.style.display = 'flex';
            imageBox.style.flexDirection = 'column';
            imageBox.style.position = 'absolute';
            imageBox.style.padding = '5px';
            imageBox.style.boxSizing = 'border-box';
            imageBox.style.overflow = 'hidden';
        }
    }

    // Preview Images
    document.getElementById('previewImages').addEventListener('click', async () => {
        if (!currentTemplate || !csvData || imageBoxes.length === 0) {
            alert('Please complete all steps before previewing images');
            return;
        }
        
        const previewBtn = document.getElementById('previewImages');
        const originalText = previewBtn.textContent;
        
        try {
            previewBtn.textContent = 'Generating Previews...';
            previewBtn.disabled = true;

            const canvas = document.getElementById('imageTemplateCanvas');
            const scaleX = originalImageSize.width / canvas.width;
            const scaleY = originalImageSize.height / canvas.height;
            
            const imageBoxConfigs = Array.from(document.querySelectorAll('.image-box')).map(box => {
                const rect = box.getBoundingClientRect();
                const container = document.getElementById('imageCanvasContainer');
                const containerRect = container.getBoundingClientRect();
                
                const relativeLeft = box.offsetLeft;
                const relativeTop = box.offsetTop;
                
                const scaledX = parseFloat((relativeLeft * scaleX).toFixed(2));
                const scaledY = parseFloat((relativeTop * scaleY).toFixed(2));
                const scaledWidth = parseFloat((parseInt(box.dataset.width || box.offsetWidth) * scaleX).toFixed(2));
                const scaledHeight = parseFloat((parseInt(box.dataset.height || box.offsetHeight) * scaleY).toFixed(2));
                
                return {
                    column: box.dataset.column,
                    x: scaledX,
                    y: scaledY,
                    width: scaledWidth,
                    height: scaledHeight,
                    isImage: true
                };
            });
            
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
                    text_boxes: imageBoxConfigs
                })
            });
            
            const data = await response.json();
            if (response.ok) {
                window.previewUrls = data.preview_urls;
                
                // Create/show carousel in the images tab
                const imagesTabContent = document.getElementById('images');
                
                // Check if a carousel already exists in the images tab
                let carousel = imagesTabContent.querySelector('.carousel');
                if (!carousel) {
                    // Create new carousel if it doesn't exist
                    const carouselContainer = document.createElement('div');
                    carouselContainer.className = 'mt-4';
                    carouselContainer.innerHTML = `
                        <div id="imagePreviewCarousel" class="carousel slide mb-4" data-bs-ride="false">
                            <div class="carousel-indicators"></div>
                            <div class="carousel-inner"></div>
                            <button class="carousel-control-prev" type="button" data-bs-target="#imagePreviewCarousel" data-bs-slide="prev">
                                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                                <span class="visually-hidden">Previous</span>
                            </button>
                            <button class="carousel-control-next" type="button" data-bs-target="#imagePreviewCarousel" data-bs-slide="next">
                                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                                <span class="visually-hidden">Next</span>
                            </button>
                            <div class="carousel-caption position-static bg-light py-3 mb-0">
                                <div id="generationStatus" class="mt-3 text-success">Previews generated successfully!</div>
                            </div>
                        </div>
                    `;
                    
                    // Insert after the main content
                    const mainRow = imagesTabContent.querySelector('.row');
                    mainRow.parentNode.insertBefore(carouselContainer, mainRow.nextSibling);
                    
                    carousel = document.getElementById('imagePreviewCarousel');
                } else {
                    carousel = carousel.id === 'imagePreviewCarousel' ? carousel : document.getElementById('imagePreviewCarousel');
                }
                
                const carouselInner = carousel.querySelector('.carousel-inner');
                const indicators = carousel.querySelector('.carousel-indicators');
                
                carouselInner.innerHTML = '';
                indicators.innerHTML = '';
                
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
                        data-bs-target="#imagePreviewCarousel" 
                        data-bs-slide-to="${index}"
                        ${index === 0 ? 'class="active" aria-current="true"' : ''}
                        aria-label="Slide ${index + 1}">
                    </button>
                `).join('');
                
                // Initialize or refresh the carousel
                const carouselInstance = bootstrap.Carousel.getInstance(carousel);
                if (carouselInstance) {
                    carouselInstance.dispose();
                }
                new bootstrap.Carousel(carousel);
                
                const downloadBtn = document.getElementById('downloadImages');
                downloadBtn.disabled = false;
                
                const statusDiv = document.getElementById('generationStatus');
                if (statusDiv) {
                    statusDiv.textContent = 'Previews generated successfully!';
                    statusDiv.className = 'mt-3 text-success';
                }
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Preview error:', error);
            alert('Error generating previews: ' + error.message);
            
            const statusDiv = document.getElementById('generationStatus');
            if (statusDiv) {
                statusDiv.textContent = 'Error generating previews: ' + error.message;
                statusDiv.className = 'mt-3 text-danger';
            }
        } finally {
            previewBtn.textContent = originalText;
            previewBtn.disabled = false;
        }
    });

    // Download Images
    document.getElementById('downloadImages').addEventListener('click', async () => {
        if (!window.previewUrls || window.previewUrls.length === 0) {
            alert('No preview images available to download. Please generate previews first.');
            return;
        }

        try {
            const downloadBtn = document.getElementById('downloadImages');
            const originalText = downloadBtn.textContent;
            downloadBtn.textContent = 'Preparing Download...';
            downloadBtn.disabled = true;

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
            const downloadBtn = document.getElementById('downloadImages');
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }
    });
}); 