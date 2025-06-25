/*
 * ===================================================================
 * QUICK IMAGE EDITOR - MAIN SCRIPT
 * ===================================================================
 * 
 * Features:
 * - Image loading via drag/drop, paste, or file picker
 * - Drawing tools: rectangle, circle, arrow, text, brush, eraser
 * - Special tools: crop, blur, numbered steps, checkmarks, crosses
 * - Object manipulation: select, move, resize, rotate
 * - Undo/redo functionality
 * - Export and copy functionality
 * 
 * File Structure:
 * 1. DOM Elements & State Variables
 * 2. Initialization & Tool Management
 * 3. Image Handling & Canvas Setup
 * 4. Drawing & Rendering Functions
 * 5. Object Manipulation (Select, Move, Resize, Rotate)
 * 6. Event Handlers (Mouse, Keyboard)
 * 7. Tool-Specific Functions
 * 8. UI & Help Functions
 * 9. Export & Save Functions
 * 
 * ===================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ===================================================================
    // 1. DOM ELEMENTS & STATE VARIABLES
    // ===================================================================
    const dropZone = document.getElementById('drop-zone');
    const imageInput = document.getElementById('image-input');
    const importBtn = document.getElementById('import-btn');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const drawingCanvas = document.getElementById('drawing-canvas');
    const drawingCtx = drawingCanvas.getContext('2d');
    const toolbar = document.querySelector('.toolbar');
    const colorPicker = document.getElementById('color-picker');
    const lineWidth = document.getElementById('line-width');
    const lineWidthNumber = document.getElementById('line-width-number');
    const toolOptions = document.getElementById('tool-options');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const resolutionDisplay = document.getElementById('resolution-display');

    // State Variables
    // ---------------
    let currentImage = null;
    let activeTool = 'select';
    
    let drawingStack = [];
    let undoStack = [];
    let redoStack = [];

    let numberCounter = 1;
    let isDrawing = false;
    let isDragging = false;
    let selectedObject = null;
    let startX, startY, offsetX, offsetY;
    
    // Crop tool state
    let isCropping = false;
    let cropRect = null;
    
    // Eraser tool state
    let currentEraserStroke = null;
    
    // Brush tool state
    let currentBrushStroke = null;
    
    // Shape selector state
    let currentShape = 'rect';
    
    // Shift key state for proportional drawing
    let isShiftPressed = false;
    
    // Text formatting state
    let textFormatting = {
        bold: false,
        italic: false,
        underline: false,
        family: 'Arial',
        size: 50
    };
    
    // Text editing state
    let isEditingText = false;
    
    // Hover state for boundary boxes
    let hoveredObject = null;
    
    // Resize/rotate state
    let resizeHandle = null;
    let initialBounds = null;
    let initialMousePos = null;
    

    
    // ===================================================================
    // 2. INITIALIZATION & TOOL MANAGEMENT
    // ===================================================================
    
    // Undo/Redo Stack Management
    // ---------------------------
    const pushToUndoStack = () => {
        undoStack.push(JSON.stringify(drawingStack));
        redoStack = []; // Clear redo stack on new action
        updateUndoRedoButtons();
    };
    
    // Tool Selection & Configuration
    // -------------------------------
    const setActiveTool = (tool) => {
        // Handle special tools that don't stay active
        if (tool === 'copy') {
            copyImage();
            return;
        }
        if (tool === 'save') {
            saveImage();
            return;
        }
        
        // Clean up crop state when switching tools
        if (activeTool === 'crop') {
            cancelCrop();
        }
        
        toolbar.querySelectorAll('.tool-btn.active').forEach(btn => btn.classList.remove('active'));
        const toolBtn = toolbar.querySelector(`[data-tool="${tool}"]`);
        if (toolBtn) toolBtn.classList.add('active');
        
        activeTool = tool;
        selectedObject = null;
        
        // Set default colors for special tools
        if (tool === 'check') {
            colorPicker.value = '#4caf50';
        }
        if (tool === 'cross') {
            colorPicker.value = '#f44336'; // Always reset to red for cross tool
        }

        // Set tool-specific default sizes
        let defaultSize;
        if (['rect', 'circle', 'shape', 'check', 'cross'].includes(tool)) {
            defaultSize = 5;
        } else if (tool === 'numbers') {
            defaultSize = 20;
        } else if (tool === 'text') {
            defaultSize = 50;
        } else if (tool === 'blur') {
            defaultSize = 69;
        } else {
            defaultSize = 10; // Default for arrows, brush, eraser, etc.
        }
        
        lineWidth.value = defaultSize;
        lineWidthNumber.value = defaultSize;
        
        const toolsWithOptions = ['rect', 'circle', 'arrow', 'text', 'blur', 'numbers', 'eraser', 'brush', 'shape', 'check', 'cross'];
        toolOptions.classList.toggle('visible', toolsWithOptions.includes(tool));
        
        // Show/hide text formatting options and size options
        const textOptions = document.getElementById('text-options');
        const sizeOptions = document.getElementById('size-options');
        const fontSize = document.getElementById('font-size');
        if (textOptions && sizeOptions) {
            if (tool === 'text') {
                textOptions.style.display = 'flex';
                sizeOptions.style.display = 'none'; // Hide regular size controls for text
                // Set font size to the text tool default (50)
                if (fontSize) {
                    fontSize.value = defaultSize;
                    textFormatting.size = defaultSize;
                }
            } else {
                textOptions.style.display = 'none';
                sizeOptions.style.display = 'flex'; // Show regular size controls for other tools
            }
        }
        
        if (currentImage) {
            redrawAnnotations();
            updateCursor();
        }
    };

    // UI State Updates
    // ----------------
    function updateUndoRedoButtons() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
    }
    
    // Initialize application
    setActiveTool('select');
    updateUndoRedoButtons();
    hideImageResolution();

    // ===================================================================
    // 3. IMAGE HANDLING & CANVAS SETUP
    // ===================================================================

    const handleImage = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                drawingStack = [];
                undoStack = [];
                redoStack = [];
                numberCounter = 1;
                selectedObject = null;
                updateUndoRedoButtons();
                resetCanvas();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    function resetCanvas() {
        if (!currentImage) return;
        
        dropZone.style.display = 'none';
        [canvas, drawingCanvas].forEach(c => c.style.display = 'block');
        
        const container = document.querySelector('.canvas-container');
        const containerRect = container.getBoundingClientRect();
        const availableWidth = containerRect.width - 40; // Account for padding
        const availableHeight = containerRect.height - 40;
        const imageRatio = currentImage.width / currentImage.height;
        
        let displayWidth = availableWidth;
        let displayHeight = displayWidth / imageRatio;

        if (displayHeight > availableHeight) {
            displayHeight = availableHeight;
            displayWidth = displayHeight * imageRatio;
        }
        
        // Ensure minimum size
        const minSize = 100;
        if (displayWidth < minSize) {
            displayWidth = minSize;
            displayHeight = displayWidth / imageRatio;
        }
        if (displayHeight < minSize) {
            displayHeight = minSize;
            displayWidth = displayHeight * imageRatio;
        }
        
        [canvas, drawingCanvas].forEach(c => {
            c.width = currentImage.width;
            c.height = currentImage.height;
            c.style.width = `${Math.round(displayWidth)}px`;
            c.style.height = `${Math.round(displayHeight)}px`;
        });

        ctx.drawImage(currentImage, 0, 0);
        
        // Show resolution display
        resolutionDisplay.textContent = `${currentImage.width} × ${currentImage.height}`;
        resolutionDisplay.style.display = 'block';
        

        
        redrawAnnotations();
    }
    
    function hideImageResolution() {
        resolutionDisplay.style.display = 'none';
    }
    
    // ===================================================================
    // 4. DRAWING & RENDERING FUNCTIONS
    // ===================================================================
    
    // Main Rendering Function
    // -----------------------
    function redrawAnnotations() {
        if (!currentImage) return; // Add null check
        
        // Redraw base image and apply permanent effects like blur
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(currentImage, 0, 0);
        drawingStack.filter(obj => obj.type === 'blur').forEach(obj => applyBlurEffect(ctx, obj));

        // Redraw vector objects and selections on the separate drawing canvas
        drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        drawingStack.filter(obj => obj.type !== 'blur').forEach(obj => drawObject(drawingCtx, obj));
        
        // Show selection box for selected object
        if (selectedObject) {
            drawSelectionBox(drawingCtx, selectedObject);
        }
        
        // Show boundary box for hovered object (when not selected)
        if (hoveredObject && hoveredObject !== selectedObject) {
            drawHoverBox(drawingCtx, hoveredObject);
        }
    }
    
    // Object Drawing Functions
    // ------------------------
    function drawObject(targetCtx, obj) {
        if (obj.type === 'blur') return;

        targetCtx.save();
        
        // Apply rotation if object has rotation
        if (obj.rotation) {
            const bounds = getObjectBounds(obj);
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            targetCtx.translate(centerX, centerY);
            targetCtx.rotate(obj.rotation);
            targetCtx.translate(-centerX, -centerY);
        }

        targetCtx.strokeStyle = obj.color;
        targetCtx.fillStyle = obj.color;
        targetCtx.lineWidth = obj.lineWidth;
        
        switch(obj.type) {
            case 'rect':
                targetCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
                break;
            case 'circle':
                targetCtx.beginPath();
                targetCtx.ellipse(obj.x + obj.width / 2, obj.y + obj.height / 2, Math.abs(obj.width / 2), Math.abs(obj.height / 2), 0, 0, 2 * Math.PI);
                targetCtx.stroke();
                break;
            case 'check':
                targetCtx.save();
                targetCtx.strokeStyle = obj.color || '#4caf50'; // Default to green for checkmarks
                targetCtx.lineWidth = obj.lineWidth;
                targetCtx.lineCap = 'round';
                targetCtx.lineJoin = 'round';
                targetCtx.beginPath();
                // Draw checkmark
                const checkStartX = obj.x + obj.width * 0.2;
                const checkStartY = obj.y + obj.height * 0.5;
                const checkMidX = obj.x + obj.width * 0.4;
                const checkMidY = obj.y + obj.height * 0.7;
                const checkEndX = obj.x + obj.width * 0.8;
                const checkEndY = obj.y + obj.height * 0.3;
                targetCtx.moveTo(checkStartX, checkStartY);
                targetCtx.lineTo(checkMidX, checkMidY);
                targetCtx.lineTo(checkEndX, checkEndY);
                targetCtx.stroke();
                targetCtx.restore();
                break;
            case 'cross':
                targetCtx.save();
                targetCtx.lineWidth = obj.lineWidth;
                targetCtx.lineCap = 'round';
                targetCtx.beginPath();
                // Draw X
                targetCtx.moveTo(obj.x, obj.y);
                targetCtx.lineTo(obj.x + obj.width, obj.y + obj.height);
                targetCtx.moveTo(obj.x + obj.width, obj.y);
                targetCtx.lineTo(obj.x, obj.y + obj.height);
                targetCtx.stroke();
                targetCtx.restore();
                break;
            case 'shape':
                // Use currentShape to determine which shape to draw
                const tempObj = { ...obj, type: currentShape };
                drawObject(targetCtx, tempObj);
                break;
            case 'arrow':
                drawArrow(targetCtx, obj.x, obj.y, obj.x + obj.width, obj.y + obj.height, obj.color, obj.lineWidth);
                break;
            case 'numbers':
                targetCtx.font = `bold ${obj.radius * 1.5}px sans-serif`;
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'middle';
                targetCtx.beginPath();
                targetCtx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
                targetCtx.fill();
                targetCtx.fillStyle = '#FFFFFF';
                targetCtx.fillText(obj.number, obj.x, obj.y);
                break;
            case 'text':
                targetCtx.font = getTextFont(obj);
                targetCtx.textAlign = 'left';
                targetCtx.textBaseline = 'top';
                targetCtx.fillText(obj.text, obj.x, obj.y);
                
                // Add underline if needed
                if (obj.underline) {
                    const metrics = targetCtx.measureText(obj.text);
                    targetCtx.strokeStyle = obj.color;
                    targetCtx.lineWidth = 1;
                    targetCtx.beginPath();
                    targetCtx.moveTo(obj.x, obj.y + obj.size + 2);
                    targetCtx.lineTo(obj.x + metrics.width, obj.y + obj.size + 2);
                    targetCtx.stroke();
                }
                break;
            case 'brush':
                targetCtx.save();
                targetCtx.strokeStyle = obj.color;
                targetCtx.lineWidth = obj.lineWidth;
                targetCtx.lineCap = 'round';
                targetCtx.lineJoin = 'round';
                targetCtx.beginPath();
                if (obj.points && obj.points.length > 1) {
                    targetCtx.moveTo(obj.points[0].x, obj.points[0].y);
                    for (let i = 1; i < obj.points.length; i++) {
                        targetCtx.lineTo(obj.points[i].x, obj.points[i].y);
                    }
                } else if (obj.points && obj.points.length === 1) {
                    targetCtx.arc(obj.points[0].x, obj.points[0].y, obj.lineWidth / 2, 0, 2 * Math.PI);
                    targetCtx.fill();
                }
                targetCtx.stroke();
                targetCtx.restore();
                break;
            case 'eraser':
                // Eraser removes objects, not image pixels
                break;
        }
        
        targetCtx.restore();
    }
    
    function drawArrow(targetCtx, fromx, fromy, tox, toy, color, lineWidth) {
        targetCtx.strokeStyle = color;
        targetCtx.fillStyle = color;
        targetCtx.lineWidth = lineWidth;
        targetCtx.lineCap = 'round';
        targetCtx.lineJoin = 'round';
        
        // Calculate arrow properties
        const dx = tox - fromx;
        const dy = toy - fromy;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length < 5) return; // Don't draw tiny arrows
        
        const angle = Math.atan2(dy, dx);
        const headLength = Math.max(12, lineWidth * 3);
        const headAngle = Math.PI / 6; // 30 degrees
        
        // Calculate where the line should end (before the arrowhead)
        const lineEndX = tox - Math.cos(angle) * (headLength * 0.4);
        const lineEndY = toy - Math.sin(angle) * (headLength * 0.4);
        
        // Draw the main line
        targetCtx.beginPath();
        targetCtx.moveTo(fromx, fromy);
        targetCtx.lineTo(lineEndX, lineEndY);
        targetCtx.stroke();
        
        // Calculate arrowhead points
        const x1 = tox - headLength * Math.cos(angle - headAngle);
        const y1 = toy - headLength * Math.sin(angle - headAngle);
        const x2 = tox - headLength * Math.cos(angle + headAngle);
        const y2 = toy - headLength * Math.sin(angle + headAngle);
        
        // Draw filled arrowhead
        targetCtx.beginPath();
        targetCtx.moveTo(tox, toy);
        targetCtx.lineTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.closePath();
        targetCtx.fill();
        
        // Outline the arrowhead
        targetCtx.beginPath();
        targetCtx.moveTo(tox, toy);
        targetCtx.lineTo(x1, y1);
        targetCtx.lineTo(x2, y2);
        targetCtx.closePath();
        targetCtx.stroke();
    }
    
    function applyBlurEffect(targetCtx, obj) {
        const { x, y, width, height, lineWidth } = obj;
        if (width <= 0 || height <= 0) return;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetCtx.canvas.width;
        tempCanvas.height = targetCtx.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(targetCtx.canvas, 0, 0);

        targetCtx.save();
        targetCtx.filter = `blur(${lineWidth / 4}px)`;
        targetCtx.drawImage(tempCanvas, x, y, width, height, x, y, width, height);
        targetCtx.restore();
    }

    function drawHoverBox(targetCtx, obj) {
        const bounds = getObjectBounds(obj);
        if (!bounds) return;
        
        targetCtx.save();
        targetCtx.strokeStyle = '#ffeb3b'; // Yellow for hover
        targetCtx.lineWidth = 2;
        targetCtx.setLineDash([4, 4]);
        targetCtx.strokeRect(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
        targetCtx.setLineDash([]);
        targetCtx.restore();
    }

    function drawSelectionBox(targetCtx, obj) {
        const bounds = getObjectBounds(obj);
        if (!bounds) return;
        
        targetCtx.save();
        targetCtx.strokeStyle = '#8ab4f8';
        targetCtx.lineWidth = 3;
        targetCtx.setLineDash([6, 6]);
        targetCtx.strokeRect(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
        targetCtx.setLineDash([]);
        
        // Draw resize handles
        const handleSize = 8;
        targetCtx.fillStyle = '#8ab4f8';
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.lineWidth = 1;
        
        // Corner handles
        const corners = [
            { x: bounds.x - 2, y: bounds.y - 2 }, // Top-left
            { x: bounds.x + bounds.width - 2, y: bounds.y - 2 }, // Top-right
            { x: bounds.x - 2, y: bounds.y + bounds.height - 2 }, // Bottom-left
            { x: bounds.x + bounds.width - 2, y: bounds.y + bounds.height - 2 } // Bottom-right
        ];
        
        corners.forEach(corner => {
            targetCtx.fillRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
            targetCtx.strokeRect(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
        });
        
        // Rotation handle (circular handle above the object)
        const rotateHandleY = bounds.y - 20;
        const rotateHandleX = bounds.x + bounds.width / 2;
        
        // Draw line from top edge to rotation handle
        targetCtx.strokeStyle = '#8ab4f8';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(bounds.x + bounds.width / 2, bounds.y - 2);
        targetCtx.lineTo(rotateHandleX, rotateHandleY);
        targetCtx.stroke();
        
        // Draw rotation handle (circle)
        targetCtx.fillStyle = '#8ab4f8';
        targetCtx.strokeStyle = '#ffffff';
        targetCtx.beginPath();
        targetCtx.arc(rotateHandleX, rotateHandleY, handleSize/2, 0, 2 * Math.PI);
        targetCtx.fill();
        targetCtx.stroke();
        
        targetCtx.restore();
    }



    function getResizeHandle(x, y, obj) {
        if (!obj) return null;
        
        const bounds = getObjectBounds(obj);
        const handleSize = 8;
        const tolerance = handleSize / 2;
        const rotateTolerance = 12; // Bigger tolerance for rotation handle
        
        // Corner handles
        const corners = [
            { x: bounds.x - 2, y: bounds.y - 2, type: 'nw-resize' }, // Top-left
            { x: bounds.x + bounds.width - 2, y: bounds.y - 2, type: 'ne-resize' }, // Top-right
            { x: bounds.x - 2, y: bounds.y + bounds.height - 2, type: 'sw-resize' }, // Bottom-left
            { x: bounds.x + bounds.width - 2, y: bounds.y + bounds.height - 2, type: 'se-resize' } // Bottom-right
        ];
        
        // Check rotation handle first (using circular detection with larger tolerance)
        const rotateHandleX = bounds.x + bounds.width / 2;
        const rotateHandleY = bounds.y - 20;
        const rotateDistance = Math.sqrt((x - rotateHandleX)**2 + (y - rotateHandleY)**2);
        if (rotateDistance <= rotateTolerance) {
            return 'rotate';
        }
        
        // Check corner handles
        for (let corner of corners) {
            if (Math.abs(x - corner.x) <= tolerance && Math.abs(y - corner.y) <= tolerance) {
                return corner.type;
            }
        }
        
        return null;
    }

    function applyResize(obj, handleType, newX, newY, initialMouseX, initialMouseY) {
        if (!obj || !initialBounds) return;
        
        if (handleType === 'rotate') {
            // Calculate rotation
            const centerX = initialBounds.x + initialBounds.width / 2;
            const centerY = initialBounds.y + initialBounds.height / 2;
            
            const currentAngle = Math.atan2(newY - centerY, newX - centerX);
            const initialAngle = Math.atan2(initialMouseY - centerY, initialMouseX - centerX);
            const deltaRotation = currentAngle - initialAngle;
            
            // Apply rotation relative to the initial rotation
            obj.rotation = (obj.initialRotation || 0) + deltaRotation;

            return;
        }
        
        const deltaX = newX - initialMouseX;
        const deltaY = newY - initialMouseY;
        
        let newBounds = { ...initialBounds };
        
        switch (handleType) {
            case 'nw-resize': // Top-left
                newBounds.x = initialBounds.x + deltaX;
                newBounds.y = initialBounds.y + deltaY;
                newBounds.width = initialBounds.width - deltaX;
                newBounds.height = initialBounds.height - deltaY;
                break;
            case 'ne-resize': // Top-right
                newBounds.y = initialBounds.y + deltaY;
                newBounds.width = initialBounds.width + deltaX;
                newBounds.height = initialBounds.height - deltaY;
                break;
            case 'sw-resize': // Bottom-left
                newBounds.x = initialBounds.x + deltaX;
                newBounds.width = initialBounds.width - deltaX;
                newBounds.height = initialBounds.height + deltaY;
                break;
            case 'se-resize': // Bottom-right
                newBounds.width = initialBounds.width + deltaX;
                newBounds.height = initialBounds.height + deltaY;
                break;
        }
        
        // Apply minimal size constraints
        const minSize = 5;
        
        if (Math.abs(newBounds.width) < minSize) return;
        if (Math.abs(newBounds.height) < minSize) return;
        
        // Free scaling with minimal constraints
        if (obj.type === 'text') {
            // For text, scale font size based on height change from original
            if (!obj.originalSize) obj.originalSize = obj.size; // Fallback for old objects
            const heightScale = Math.abs(newBounds.height) / initialBounds.height;
            const newSize = obj.originalSize * heightScale;
            
            // Apply only basic font size limits
            if (newSize < 4) return;
            
            obj.x = newBounds.x;
            obj.y = newBounds.y;
            obj.size = newSize;
        } else {
            // For other objects, scale from original dimensions
            if (!obj.originalWidth) obj.originalWidth = obj.width; // Fallback for old objects
            if (!obj.originalHeight) obj.originalHeight = obj.height; // Fallback for old objects
            
            const scaleX = newBounds.width / initialBounds.width;
            const scaleY = newBounds.height / initialBounds.height;
            
            obj.x = newBounds.x;
            obj.y = newBounds.y;
            obj.width = obj.originalWidth * scaleX;
            obj.height = obj.originalHeight * scaleY;
        }
    }

    // --- Undo/Redo ---
    
    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(JSON.stringify(drawingStack));
        drawingStack = JSON.parse(undoStack.pop());
        selectedObject = null;
        redrawAnnotations();
        updateUndoRedoButtons();
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(JSON.stringify(drawingStack));
        drawingStack = JSON.parse(redoStack.pop());
        selectedObject = null;
        redrawAnnotations();
        updateUndoRedoButtons();
    }

    // --- Event Listeners ---
    
    window.addEventListener('resize', resetCanvas);
    
    // --- File Import Listeners ---
    importBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => handleImage(e.target.files[0]));

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#8ab4f8'; });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.style.borderColor = '#5f6368'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#5f6368';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImage(e.dataTransfer.files[0]);
        }
    });
    
    // Add drop support to canvas area
    drawingCanvas.addEventListener('dragover', (e) => { e.preventDefault(); });
    drawingCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleImage(e.dataTransfer.files[0]);
        }
    });
    
    window.addEventListener('paste', (e) => {
        if (e.clipboardData.files && e.clipboardData.files.length > 0) {
            handleImage(e.clipboardData.files[0]);
        }
    });
    
    window.addEventListener("dragover", e => e.preventDefault());
    window.addEventListener("drop", e => e.preventDefault());


    // --- Toolbar & Input Listeners ---
    toolbar.addEventListener('click', (e) => {
        const toolBtn = e.target.closest('.tool-btn');
        if (!toolBtn) return;
        const tool = toolBtn.dataset.tool;
        if (tool) setActiveTool(tool);
    });
    
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    
    // Help button functionality
    const helpBtn = document.getElementById('help-btn');
    helpBtn.addEventListener('click', showHelpDialog);
    
    // Shape selector functionality
    const shapeBtn = document.querySelector('.shape-btn');
    const shapeMenu = document.getElementById('shape-menu');
    
    shapeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shapeMenu.classList.toggle('visible');
    });
    
    shapeMenu.addEventListener('click', (e) => {
        if (e.target.closest('[data-shape]')) {
            const shape = e.target.closest('[data-shape]').dataset.shape;
            currentShape = shape;
            
            // Set green color for checkmarks
            if (shape === 'check') {
                colorPicker.value = '#4caf50';
            }
            
            // Update button icon
            const icon = shapeBtn.querySelector('.material-symbols-outlined');
            const iconMap = {
                'rect': 'crop_din',
                'circle': 'circle',
                'check': 'check',
                'cross': 'close'
            };
            icon.textContent = iconMap[shape];
            
            // Set active tool based on shape
            setActiveTool(shape === 'rect' || shape === 'circle' ? shape : 'shape');
            shapeMenu.classList.remove('visible');
        }
    });
    
    // Close shape menu when clicking outside
    document.addEventListener('click', () => {
        shapeMenu.classList.remove('visible');
    });
    
    // Sync number input with range slider
    lineWidth.addEventListener('input', () => {
        lineWidthNumber.value = lineWidth.value;
    });
    
    lineWidthNumber.addEventListener('input', () => {
        lineWidth.value = lineWidthNumber.value;
        lineWidth.dispatchEvent(new Event('input'));
    });
    
    // Text formatting event listeners
    const fontFamily = document.getElementById('font-family');
    const fontSize = document.getElementById('font-size');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    
    fontFamily.addEventListener('change', () => {
        textFormatting.family = fontFamily.value;
        // Update selected text object if any
        if (selectedObject && selectedObject.type === 'text') {
            pushToUndoStack();
            selectedObject.family = fontFamily.value;
            // Update original size when font changes
            if (!selectedObject.originalSize) {
                selectedObject.originalSize = selectedObject.size;
            }
            redrawAnnotations();
        }
    });
    
    fontSize.addEventListener('input', () => {
        textFormatting.size = parseInt(fontSize.value);
        // Update selected text object if any
        if (selectedObject && selectedObject.type === 'text') {
            selectedObject.size = parseInt(fontSize.value);
            // Update original size when font size changes
            selectedObject.originalSize = parseInt(fontSize.value);
            redrawAnnotations();
        }
    });
    
    boldBtn.addEventListener('click', () => {
        textFormatting.bold = !textFormatting.bold;
        boldBtn.classList.toggle('active', textFormatting.bold);
        // Update selected text object if any
        if (selectedObject && selectedObject.type === 'text') {
            pushToUndoStack();
            selectedObject.bold = textFormatting.bold;
            redrawAnnotations();
        }
    });
    
    italicBtn.addEventListener('click', () => {
        textFormatting.italic = !textFormatting.italic;
        italicBtn.classList.toggle('active', textFormatting.italic);
        // Update selected text object if any
        if (selectedObject && selectedObject.type === 'text') {
            pushToUndoStack();
            selectedObject.italic = textFormatting.italic;
            redrawAnnotations();
        }
    });
    
    underlineBtn.addEventListener('click', () => {
        textFormatting.underline = !textFormatting.underline;
        underlineBtn.classList.toggle('active', textFormatting.underline);
        // Update selected text object if any
        if (selectedObject && selectedObject.type === 'text') {
            pushToUndoStack();
            selectedObject.underline = textFormatting.underline;
            redrawAnnotations();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') isShiftPressed = true;
        
        if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        if (e.key === 'Delete' && selectedObject) { 
            e.preventDefault();
            pushToUndoStack();
            drawingStack.splice(drawingStack.indexOf(selectedObject), 1);
            selectedObject = null;
            redrawAnnotations();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            if (isCropping) {
                cancelCrop();
            } else if (selectedObject) {
                selectedObject = null;
                redrawAnnotations();
            }
        }
        // Tool shortcuts
        if (!e.ctrlKey && !e.altKey && !e.shiftKey && !isEditingText) { // Don't change tools while editing text
            switch(e.key.toLowerCase()) {
                case 's': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('select'); } break;
                case 'c': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('crop'); } break;
                case 't': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('text'); } break;
                case 'r': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('rect'); } break;
                case 'o': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('circle'); } break;
                case 'a': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('arrow'); } break;
                case 'n': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('numbers'); } break;
                case 'b': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('blur'); } break;
                case 'u': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('brush'); } break;
                case 'e': if (e.target.tagName !== 'INPUT') { e.preventDefault(); setActiveTool('eraser'); } break;
                case '?': if (e.target.tagName !== 'INPUT') { e.preventDefault(); showHelpDialog(); } break;
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') isShiftPressed = false;
    });

    // Reduce aggressive undo stack pushing on input changes
    let inputChangeTimeout;
    [colorPicker, lineWidth].forEach(el => el.addEventListener('input', () => {
        if (selectedObject) {
            // Debounce undo stack pushes to avoid spam
            clearTimeout(inputChangeTimeout);
            inputChangeTimeout = setTimeout(() => {
                pushToUndoStack();
            }, 1000);
            
            selectedObject.color = colorPicker.value;
            const sizeAttr = selectedObject.type === 'text' ? 'size' : 'lineWidth';
            selectedObject[sizeAttr] = parseInt(lineWidth.value);
            if(selectedObject.type === 'numbers') selectedObject.radius = parseInt(lineWidth.value);
            redrawAnnotations();
        }
    }));

    // --- Main Canvas Interaction Listeners ---
    drawingCanvas.addEventListener('mousedown', (e) => {
        if (!currentImage) return;
        
        const rect = drawingCanvas.getBoundingClientRect();
        startX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
        startY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);
        
        isDrawing = true;
        
        if (activeTool === 'select') {
            // First check if clicking on resize handle of currently selected object
            if (selectedObject) {
                resizeHandle = getResizeHandle(startX, startY, selectedObject);
                if (!resizeHandle) {
                    // Not clicking on handle, check for new object selection
                    selectedObject = getObjectAt(startX, startY);
                }
            } else {
                // No object currently selected, find one
                selectedObject = getObjectAt(startX, startY);
            }
            
            if (selectedObject) {
                // If we don't have a resize handle yet, check for one on the current object
                if (!resizeHandle) {
                    resizeHandle = getResizeHandle(startX, startY, selectedObject);
                }
                
                if (resizeHandle) {
                    // Start resizing
                    pushToUndoStack();
                    initialBounds = getObjectBounds(selectedObject);
                    initialMousePos = { x: startX, y: startY };
                    // Store initial rotation for rotation operations
                    selectedObject.initialRotation = selectedObject.rotation || 0;

                    isDragging = false; // Not dragging, resizing
                } else {
                    // For select tool, just select the object (no single-click editing)
                    pushToUndoStack();
                    isDragging = true;
                    const bounds = getObjectBounds(selectedObject);
                    offsetX = startX - bounds.x;
                    offsetY = startY - bounds.y;
                }
                updateToolOptions(selectedObject);
            }
            redrawAnnotations();
        } else if (activeTool === 'crop') {
            isCropping = true;
            cropRect = { x: startX, y: startY, width: 0, height: 0 };
            selectedObject = null;
        } else if (activeTool === 'text') {
            // Special handling for text tool
            if (isEditingText) {
                // If already editing text, don't create new text input
                return;
            }
            
            // First check if clicking on resize handle of currently selected text
            if (selectedObject && selectedObject.type === 'text') {
                resizeHandle = getResizeHandle(startX, startY, selectedObject);
                if (!resizeHandle) {
                    // Not clicking on handle, check for new text selection
                    const clickedText = getObjectAt(startX, startY);
                    if (clickedText && clickedText.type === 'text') {
                        selectedObject = clickedText;
                        resizeHandle = getResizeHandle(startX, startY, selectedObject);
                    } else {
                        // Create new text
                        createTextInput(startX, startY);
                        selectedObject = null;
                        return;
                    }
                }
            } else {
                // Check if clicking on existing text
                const clickedText = getObjectAt(startX, startY);
                if (clickedText && clickedText.type === 'text') {
                    // Single click on text - select and allow moving/scaling
                    selectedObject = clickedText;
                    
                    // Check if clicking on resize handle
                    resizeHandle = getResizeHandle(startX, startY, selectedObject);
                } else {
                    // Create new text at click position
                    createTextInput(startX, startY);
                    selectedObject = null;
                    return;
                }
            }
            
            if (selectedObject) {
                if (resizeHandle) {
                    // Start resizing
                    pushToUndoStack();
                    initialBounds = getObjectBounds(selectedObject);
                    initialMousePos = { x: startX, y: startY };
                    // Store initial rotation for rotation operations
                    selectedObject.initialRotation = selectedObject.rotation || 0;

                    isDragging = false; // Not dragging, resizing
                } else {
                    // Start dragging
                    pushToUndoStack();
                    isDragging = true;
                    const bounds = getObjectBounds(selectedObject);
                    offsetX = startX - bounds.x;
                    offsetY = startY - bounds.y;
                }
                updateToolOptions(selectedObject);
            }
        } else {
             selectedObject = null;
             pushToUndoStack();
             
             // Special handling for eraser and brush tools
             if (activeTool === 'eraser') {
                 // Eraser removes objects at click position
                 const objectToRemove = getObjectAt(startX, startY);
                 if (objectToRemove) {
                     const index = drawingStack.indexOf(objectToRemove);
                     if (index > -1) {
                         drawingStack.splice(index, 1);
                         redrawAnnotations();
                     }
                 }
                 // Track eraser for dragging mode
                 currentEraserStroke = { isActive: true };
             } else if (activeTool === 'brush') {
                 currentBrushStroke = {
                     type: 'brush',
                     points: [{ x: startX, y: startY }],
                     color: colorPicker.value,
                     lineWidth: parseInt(lineWidth.value)
                 };
                 drawingStack.push(currentBrushStroke);
             }
        }
    });
    
    drawingCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !currentImage) return;
        
        const rect = drawingCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);

        if ((activeTool === 'select' || activeTool === 'text') && selectedObject) {
            if (resizeHandle && initialBounds && initialMousePos) {
                // Handle resizing
                applyResize(selectedObject, resizeHandle, mouseX, mouseY, initialMousePos.x, initialMousePos.y);
                redrawAnnotations();
            } else if (isDragging) {
                // Handle dragging
                if (selectedObject.type === 'text') {
                    // For text objects, update x and y directly
                    selectedObject.x = mouseX - offsetX;
                    selectedObject.y = mouseY - offsetY;
                } else {
                    // For other objects
                    selectedObject.x = mouseX - offsetX;
                    selectedObject.y = mouseY - offsetY;
                }
                redrawAnnotations();
            }
        } else if (activeTool === 'crop' && isCropping) {
            cropRect.width = mouseX - cropRect.x;
            cropRect.height = mouseY - cropRect.y;
            redrawAnnotations();
            drawCropPreview();
        } else if (activeTool === 'brush' && currentBrushStroke) {
            // Add point to current brush stroke
            currentBrushStroke.points.push({ x: mouseX, y: mouseY });
            redrawAnnotations();
        } else if (activeTool === 'eraser' && currentEraserStroke && currentEraserStroke.isActive) {
            // Erase objects at current position while dragging
            const objectToRemove = getObjectAt(mouseX, mouseY);
            if (objectToRemove) {
                const index = drawingStack.indexOf(objectToRemove);
                if (index > -1) {
                    drawingStack.splice(index, 1);
                    redrawAnnotations();
                }
            }
        } else if (activeTool !== 'select' && activeTool !== 'numbers' && activeTool !== 'crop' && activeTool !== 'eraser' && activeTool !== 'brush' && activeTool !== 'text') { // Don't show preview for numbers, crop, eraser, brush, or text
            redrawAnnotations(); // Redraw existing objects
            
            let drawWidth = mouseX - startX;
            let drawHeight = mouseY - startY;
            
            // Apply proportional drawing with Shift key
            if (isShiftPressed) {
                const currentTool = activeTool === 'shape' ? currentShape : activeTool;
                if (currentTool === 'rect' || currentTool === 'circle') {
                    // For rect and circle: make square/perfect circle
                    const size = Math.max(Math.abs(drawWidth), Math.abs(drawHeight));
                    drawWidth = drawWidth >= 0 ? size : -size;
                    drawHeight = drawHeight >= 0 ? size : -size;
                } else if (currentTool === 'check' || currentTool === 'cross') {
                    // For check and cross: Shift makes them NON-proportional (opposite behavior)
                    // When shift is pressed, allow free drawing (do nothing)
                }
            } else {
                const currentTool = activeTool === 'shape' ? currentShape : activeTool;
                if (currentTool === 'check' || currentTool === 'cross') {
                    // For check and cross: proportional by default (without shift)
                    const size = Math.min(Math.abs(drawWidth), Math.abs(drawHeight));
                    drawWidth = drawWidth >= 0 ? size : -size;
                    drawHeight = drawHeight >= 0 ? size : -size;
                }
            }
            
            // Draw temporary shape for preview
            drawingCtx.save();
            if (activeTool === 'blur') {
                // Show blur preview as a rectangle with dashed border
                drawingCtx.strokeStyle = '#8ab4f8';
                drawingCtx.lineWidth = 2;
                drawingCtx.setLineDash([5, 5]);
                drawingCtx.strokeRect(startX, startY, drawWidth, drawHeight);
                drawingCtx.setLineDash([]);
                
                // Add text to show it's blur area
                drawingCtx.fillStyle = '#8ab4f8';
                drawingCtx.font = '12px sans-serif';
                drawingCtx.fillText('Blur Area', startX + 5, startY - 5);
            } else {
                drawObject(drawingCtx, {
                    type: activeTool === 'shape' ? currentShape : activeTool,
                    x: startX,
                    y: startY,
                    width: drawWidth,
                    height: drawHeight,
                    color: colorPicker.value,
                    lineWidth: parseInt(lineWidth.value)
                });
            }
            drawingCtx.restore();
        }
    });

    drawingCanvas.addEventListener('mouseup', (e) => {
        if (!currentImage || !isDrawing) {
            isDrawing = false;
            isDragging = false;
            currentEraserStroke = null; // Reset eraser stroke
            currentBrushStroke = null; // Reset brush stroke
            return;
        }

        const rect = drawingCanvas.getBoundingClientRect();
        const endX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
        const endY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);
        const wasClick = Math.abs(endX - startX) < 5 && Math.abs(endY - startY) < 5;

        if (activeTool === 'crop' && isCropping) {
            if (!wasClick && Math.abs(cropRect.width) > 10 && Math.abs(cropRect.height) > 10) {
                showCropButtons();
            } else {
                isCropping = false;
                cropRect = null;
                redrawAnnotations();
            }
        } else if (activeTool !== 'select' && activeTool !== 'text') {
            let newObject;
            if (wasClick) {
                if (activeTool === 'numbers') {
                    newObject = createObject(endX, endY);
                } else if (['rect', 'circle', 'arrow', 'blur', 'shape'].includes(activeTool)) {
                    // Create shape with current tool size on click
                    const size = parseInt(lineWidth.value);
                    newObject = createObject(startX - size/2, startY - size/2, startX + size/2, startY + size/2);
                } else if (['check', 'cross'].includes(activeTool) || (activeTool === 'shape' && ['check', 'cross'].includes(currentShape))) {
                    // Create 20x20 proportional checkmark or cross on click
                    const size = 20;
                    newObject = createObject(startX - size/2, startY - size/2, startX + size/2, startY + size/2);
                }
            } else {
                let drawWidth = endX - startX;
                let drawHeight = endY - startY;
                
                // Apply proportional drawing with Shift key
                if (isShiftPressed) {
                    const currentTool = activeTool === 'shape' ? currentShape : activeTool;
                    if (currentTool === 'rect' || currentTool === 'circle') {
                        // For rect and circle: make square/perfect circle
                        const size = Math.max(Math.abs(drawWidth), Math.abs(drawHeight));
                        drawWidth = drawWidth >= 0 ? size : -size;
                        drawHeight = drawHeight >= 0 ? size : -size;
                    } else if (currentTool === 'check' || currentTool === 'cross') {
                        // For check and cross: Shift makes them NON-proportional (opposite behavior)
                        // When shift is pressed, allow free drawing (do nothing)
                    }
                } else {
                    const currentTool = activeTool === 'shape' ? currentShape : activeTool;
                    if (currentTool === 'check' || currentTool === 'cross') {
                        // For check and cross: proportional by default (without shift)
                        const size = Math.min(Math.abs(drawWidth), Math.abs(drawHeight));
                        drawWidth = drawWidth >= 0 ? size : -size;
                        drawHeight = drawHeight >= 0 ? size : -size;
                    }
                }
                
                newObject = createObject(startX, startY, startX + drawWidth, startY + drawHeight);
            }
            if(newObject) drawingStack.push(newObject);
        }
        
        // Update original dimensions after a resize operation completes
        if (resizeHandle && selectedObject && initialBounds) {
            if (selectedObject.type === 'text') {
                // For text, update original size to current size
                selectedObject.originalSize = selectedObject.size;
            } else {
                // For shapes, update original dimensions to current dimensions
                selectedObject.originalWidth = Math.abs(selectedObject.width);
                selectedObject.originalHeight = Math.abs(selectedObject.height);
            }
            // Clean up rotation tracking - the current rotation is now the base rotation
            delete selectedObject.initialRotation;
        }
        
        isDrawing = false;
        isDragging = false;
        resizeHandle = null; // Reset resize state
        initialBounds = null;
        initialMousePos = null;
        currentEraserStroke = null; // Reset eraser stroke
        currentBrushStroke = null; // Reset brush stroke
        redrawAnnotations();
    });
    
    drawingCanvas.addEventListener('dblclick', (e) => {
        if (!currentImage) return;
        
        const rect = drawingCanvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);
        
        const clickedObject = getObjectAt(clickX, clickY);
        if (clickedObject && clickedObject.type === 'text') {
            // Double click on text - start editing
            createTextInput(clickedObject.x, clickedObject.y, clickedObject);
        }
    });



    // Add hover detection for boundary boxes
    drawingCanvas.addEventListener('mousemove', (e) => {
        if (!currentImage || isDrawing || isEditingText) return;
        
        const rect = drawingCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);
        
        // Check if hovering over any object when in select mode or text tool
        if (activeTool === 'select' || activeTool === 'text') {
            const objectUnderMouse = getObjectAt(mouseX, mouseY);
            
            // Check for resize handles on selected object
            if (selectedObject && (activeTool === 'select' || activeTool === 'text')) {
                const handleType = getResizeHandle(mouseX, mouseY, selectedObject);
                if (handleType === 'rotate') {
                    drawingCanvas.style.cursor = 'crosshair';
                } else if (handleType) {
                    drawingCanvas.style.cursor = handleType;
                } else {
                    drawingCanvas.style.cursor = objectUnderMouse ? 'move' : 'default';
                }
            } else {
                drawingCanvas.style.cursor = objectUnderMouse ? 'pointer' : 'default';
            }
            
            // Only show hover box if object is not selected
            const newHoveredObject = selectedObject ? null : objectUnderMouse;
            if (newHoveredObject !== hoveredObject) {
                hoveredObject = newHoveredObject;
                redrawAnnotations(); // Redraw to show/hide boundary boxes
            }
        } else {
            // Clear hover state for other tools
            if (hoveredObject) {
                hoveredObject = null;
                redrawAnnotations();
            }
            updateCursor();
        }
    });

    // --- Tool-specific Functions ---
    
    function createObject(x1, y1, x2, y2) {
        let newObj = {
            type: activeTool === 'shape' ? currentShape : activeTool,
            color: colorPicker.value,
            rotation: 0
        };
        
        // Set green color for checkmarks by default
        if ((activeTool === 'check') || (activeTool === 'shape' && currentShape === 'check')) {
            newObj.color = '#4caf50';
        }

        if (activeTool === 'numbers') {
            newObj = { ...newObj, x: x1, y: y1, number: numberCounter++, radius: parseInt(lineWidth.value) };
        } else if (activeTool === 'eraser') {
            // Eraser objects are handled differently in mouse events
            return null;
        } else {
            let width = x2 - x1;
            let height = y2 - y1;
            
            // Set default arrow size to 10 if too small or clicked without dragging
            if (activeTool === 'arrow' && (Math.abs(width) < 10 || Math.abs(height) < 10)) {
                const direction = { x: width >= 0 ? 1 : -1, y: height >= 0 ? 1 : -1 };
                width = 10 * direction.x;
                height = 10 * direction.y;
            }
            
            newObj = { ...newObj, x: x1, y: y1, width: width, height: height, lineWidth: parseInt(lineWidth.value) };
            
            // Store original dimensions when object is created
            newObj.originalWidth = Math.abs(width);
            newObj.originalHeight = Math.abs(height);
            
            // Don't adjust coordinates for arrows - they need to maintain direction
            if (activeTool !== 'arrow' && (activeTool !== 'shape' || currentShape !== 'arrow')) {
                if (width < 0) { newObj.x = x2; newObj.width *= -1; }
                if (height < 0) { newObj.y = y2; newObj.height *= -1; }
            }
        }
        return newObj;
    }
    
    // Text editing state
    let currentTextObj = null;
    let textCursor = 0;
    let textBlinkTimer = null;

    function createTextInput(x, y, existingObj = null) {
        // Only push to undo stack for new text, not edits
        if (!existingObj) pushToUndoStack();
        
        // Set editing state
        isEditingText = true;

        // Get current formatting settings
        const currentFormatting = {
            size: existingObj ? existingObj.size : textFormatting.size,
            family: existingObj ? existingObj.family : textFormatting.family,
            bold: existingObj ? existingObj.bold : textFormatting.bold,
            italic: existingObj ? existingObj.italic : textFormatting.italic,
            underline: existingObj ? existingObj.underline : textFormatting.underline,
            color: existingObj ? existingObj.color : colorPicker.value
        };

        // Create or update text object
        if (existingObj) {
            currentTextObj = existingObj;
            textCursor = existingObj.text.length;
        } else {
            currentTextObj = {
                type: 'text',
                x: x,
                y: y,
                text: '',
                color: currentFormatting.color,
                size: currentFormatting.size,
                family: currentFormatting.family,
                bold: currentFormatting.bold,
                italic: currentFormatting.italic,
                underline: currentFormatting.underline,
                rotation: 0,
                originalSize: currentFormatting.size
            };
            drawingStack.push(currentTextObj);
            textCursor = 0;
        }

        // Start blinking cursor
        let showCursor = true;
        textBlinkTimer = setInterval(() => {
            showCursor = !showCursor;
            redrawAnnotations();
            if (isEditingText && currentTextObj) {
                drawTextCursor(showCursor);
            }
        }, 500);

        // Initial draw
        redrawAnnotations();
        drawTextCursor(true);

        // Handle global keyboard events
        const handleGlobalKeydown = (e) => {
            if (!isEditingText || !currentTextObj) return;
            
            // Only handle text input events
            if (e.target === document.body || e.target === document.documentElement) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                if (e.key === 'Enter' || e.key === 'Escape') {
                    applyText();
                } else if (e.ctrlKey && e.key.toLowerCase() === 'a') {
                    // Ctrl+A: Select all text (position cursor at end, next input will replace all)
                    textCursor = currentTextObj.text.length;
                    // Set a flag to indicate all text is "selected"
                    currentTextObj.isAllSelected = true;
                    redrawAnnotations();
                    drawTextCursor(true);
                } else if (e.key === 'Backspace') {
                    if (currentTextObj.isAllSelected) {
                        // If all text is selected, delete all text
                        currentTextObj.text = '';
                        textCursor = 0;
                        currentTextObj.isAllSelected = false;
                    } else if (textCursor > 0) {
                        currentTextObj.text = currentTextObj.text.slice(0, textCursor - 1) + currentTextObj.text.slice(textCursor);
                        textCursor--;
                    }
                    redrawAnnotations();
                    drawTextCursor(true);
                } else if (e.key === 'Delete') {
                    if (currentTextObj.isAllSelected) {
                        // If all text is selected, delete all text
                        currentTextObj.text = '';
                        textCursor = 0;
                        currentTextObj.isAllSelected = false;
                    } else if (textCursor < currentTextObj.text.length) {
                        currentTextObj.text = currentTextObj.text.slice(0, textCursor) + currentTextObj.text.slice(textCursor + 1);
                    }
                    redrawAnnotations();
                    drawTextCursor(true);
                } else if (e.key === 'ArrowLeft') {
                    currentTextObj.isAllSelected = false; // Clear selection
                    if (textCursor > 0) {
                        textCursor--;
                        redrawAnnotations();
                        drawTextCursor(true);
                    }
                } else if (e.key === 'ArrowRight') {
                    currentTextObj.isAllSelected = false; // Clear selection
                    if (textCursor < currentTextObj.text.length) {
                        textCursor++;
                        redrawAnnotations();
                        drawTextCursor(true);
                    }
                } else if (e.key === 'Home') {
                    currentTextObj.isAllSelected = false; // Clear selection
                    textCursor = 0;
                    redrawAnnotations();
                    drawTextCursor(true);
                } else if (e.key === 'End') {
                    currentTextObj.isAllSelected = false; // Clear selection
                    textCursor = currentTextObj.text.length;
                    redrawAnnotations();
                    drawTextCursor(true);
                } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    // Regular character input (excluding modifier combinations)
                    if (currentTextObj.isAllSelected) {
                        // If all text was selected (Ctrl+A), replace entire text
                        currentTextObj.text = e.key;
                        textCursor = 1;
                        currentTextObj.isAllSelected = false;
                    } else {
                        // Normal character insertion
                        currentTextObj.text = currentTextObj.text.slice(0, textCursor) + e.key + currentTextObj.text.slice(textCursor);
                        textCursor++;
                    }
                    redrawAnnotations();
                    drawTextCursor(true);
                }
            }
        };

        // Handle clicking outside
        const handleClickOutside = (e) => {
            if (isEditingText && e.target === drawingCanvas) {
                const rect = drawingCanvas.getBoundingClientRect();
                const clickX = (e.clientX - rect.left) * (drawingCanvas.width / rect.width);
                const clickY = (e.clientY - rect.top) * (drawingCanvas.height / rect.height);
                
                // Check if clicking on the current text object
                const bounds = getObjectBounds(currentTextObj);
                if (clickX >= bounds.x && clickX <= bounds.x + bounds.width && 
                    clickY >= bounds.y && clickY <= bounds.y + bounds.height) {
                    // Calculate cursor position based on click
                    const tempCtx = drawingCanvas.getContext('2d');
                    tempCtx.font = getTextFont(currentTextObj);
                    let clickPos = 0;
                    let totalWidth = 0;
                    
                    for (let i = 0; i <= currentTextObj.text.length; i++) {
                        const charWidth = i < currentTextObj.text.length ? 
                            tempCtx.measureText(currentTextObj.text[i]).width : 0;
                        
                        if (clickX <= currentTextObj.x + totalWidth + charWidth / 2) {
                            clickPos = i;
                            break;
                        }
                        totalWidth += charWidth;
                        clickPos = i + 1;
                    }
                    
                    textCursor = clickPos;
                    redrawAnnotations();
                    drawTextCursor(true);
                } else {
                    applyText();
                }
            }
        };

        // Apply text function
        const applyText = () => {
            if (isEditingText) {
                isEditingText = false;
                
                if (textBlinkTimer) {
                    clearInterval(textBlinkTimer);
                    textBlinkTimer = null;
                }
                
                if (!currentTextObj.text.trim()) {
                    // Remove empty text object
                    const index = drawingStack.indexOf(currentTextObj);
                    if (index > -1) {
                        drawingStack.splice(index, 1);
                    }
                }

                // Clean up
                document.removeEventListener('click', handleClickOutside, true);
                document.removeEventListener('keydown', handleGlobalKeydown, true);
                
                // Reset state
                currentTextObj = null;
                textCursor = 0;
                
                // Redraw canvas
                redrawAnnotations();
                selectedObject = null;
            }
        };

        // Add event listeners
        setTimeout(() => {
            document.addEventListener('click', handleClickOutside, true);
            document.addEventListener('keydown', handleGlobalKeydown, true);
        }, 100);
    }

    function drawTextCursor(show) {
        if (!show || !isEditingText || !currentTextObj) return;
        
        // Calculate cursor position and text metrics
        const tempCtx = drawingCanvas.getContext('2d');
        tempCtx.font = getTextFont(currentTextObj);
        
        drawingCtx.save();
        
        // If all text is selected (Ctrl+A), draw selection highlight
        if (currentTextObj.isAllSelected && currentTextObj.text.length > 0) {
            const textMetrics = tempCtx.measureText(currentTextObj.text);
            const textWidth = textMetrics.width;
            const textHeight = currentTextObj.size;
            
            // Draw selection background (blue highlight)
            drawingCtx.fillStyle = 'rgba(0, 120, 215, 0.3)'; // Windows-style selection blue
            drawingCtx.fillRect(
                currentTextObj.x - 2, 
                currentTextObj.y - 2, 
                textWidth + 4, 
                textHeight + 4
            );
            
            // Draw selection border
            drawingCtx.strokeStyle = 'rgba(0, 120, 215, 0.8)';
            drawingCtx.lineWidth = 1;
            drawingCtx.strokeRect(
                currentTextObj.x - 2, 
                currentTextObj.y - 2, 
                textWidth + 4, 
                textHeight + 4
            );
        } else {
            // Normal cursor drawing
            let cursorX = currentTextObj.x;
            if (textCursor > 0) {
                const textBeforeCursor = currentTextObj.text.slice(0, textCursor);
                cursorX += tempCtx.measureText(textBeforeCursor).width;
            }
            
            // Draw thick, visible cursor line
            drawingCtx.strokeStyle = currentTextObj.color;
            drawingCtx.lineWidth = Math.max(2, currentTextObj.size / 10); // Thicker cursor, scales with text size
            drawingCtx.lineCap = 'round';
            drawingCtx.beginPath();
            drawingCtx.moveTo(cursorX, currentTextObj.y);
            drawingCtx.lineTo(cursorX, currentTextObj.y + currentTextObj.size);
            drawingCtx.stroke();
            
            // Add a subtle glow effect for better visibility
            drawingCtx.shadowColor = currentTextObj.color;
            drawingCtx.shadowBlur = 2;
            drawingCtx.stroke();
        }
        
        drawingCtx.restore();
    }
    
    function getObjectAt(x, y) {
        for (let i = drawingStack.length - 1; i >= 0; i--) {
            const obj = drawingStack[i];
            
            // Special handling for brush strokes - check if point is near any stroke point
            if (obj.type === 'brush' && obj.points && obj.points.length > 0) {
                const tolerance = obj.lineWidth / 2 + 2; // Reduced tolerance
                for (let j = 0; j < obj.points.length - 1; j++) {
                    const p1 = obj.points[j];
                    const p2 = obj.points[j + 1];
                    const dist = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
                    if (dist <= tolerance) {
                        return obj;
                    }
                }
                continue;
            }
            
            // Special handling for arrows - more precise hit detection
            if (obj.type === 'arrow') {
                const tolerance = obj.lineWidth / 2 + 2;
                const dist = distanceToLineSegment(x, y, obj.x, obj.y, obj.x + obj.width, obj.y + obj.height);
                if (dist <= tolerance) {
                    return obj;
                }
                continue;
            }
            
            // Regular bounds checking for other objects with smaller tolerance
            const bounds = getObjectBounds(obj);
            const tolerance = 3; // Small tolerance for better precision
            if (x >= bounds.x - tolerance && x <= bounds.x + bounds.width + tolerance && 
                y >= bounds.y - tolerance && y <= bounds.y + bounds.height + tolerance) {
                return obj;
            }
        }
        return null;
    }
    
    // Helper function to calculate distance from point to line segment
    function distanceToLineSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }
        
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)));
        const projection = {
            x: x1 + t * dx,
            y: y1 + t * dy
        };
        
        return Math.sqrt((px - projection.x) * (px - projection.x) + (py - projection.y) * (py - projection.y));
    }

    function getObjectBounds(obj) {
        if(!obj) return {x:0, y:0, width:0, height:0};
        let bounds = { x: obj.x, y: obj.y, width: obj.width || 0, height: obj.height || 0 };
        
        switch(obj.type) {
            case 'numbers':
                bounds = { x: obj.x - obj.radius, y: obj.y - obj.radius, width: obj.radius * 2, height: obj.radius * 2 };
                break;
            case 'text':
                // Create a temporary context to measure text accurately
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.font = getTextFont(obj);
                const metrics = tempCtx.measureText(obj.text);
                const actualHeight = obj.size; // Use font size as height
                bounds = { 
                    x: obj.x, 
                    y: obj.y, 
                    width: metrics.width, 
                    height: actualHeight
                };
                break;
            case 'brush':
                if (obj.points && obj.points.length > 0) {
                    const xs = obj.points.map(p => p.x);
                    const ys = obj.points.map(p => p.y);
                    const minX = Math.min(...xs) - obj.lineWidth / 2;
                    const maxX = Math.max(...xs) + obj.lineWidth / 2;
                    const minY = Math.min(...ys) - obj.lineWidth / 2;
                    const maxY = Math.max(...ys) + obj.lineWidth / 2;
                    bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                } else {
                    bounds = { x: obj.x - obj.lineWidth / 2, y: obj.y - obj.lineWidth / 2, width: obj.lineWidth, height: obj.lineWidth };
                }
                break;
            case 'eraser':
                if (obj.points && obj.points.length > 0) {
                    const xs = obj.points.map(p => p.x);
                    const ys = obj.points.map(p => p.y);
                    const minX = Math.min(...xs) - obj.lineWidth / 2;
                    const maxX = Math.max(...xs) + obj.lineWidth / 2;
                    const minY = Math.min(...ys) - obj.lineWidth / 2;
                    const maxY = Math.max(...ys) + obj.lineWidth / 2;
                    bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                } else {
                    bounds = { x: obj.x - obj.lineWidth / 2, y: obj.y - obj.lineWidth / 2, width: obj.lineWidth, height: obj.lineWidth };
                }
                break;
        }
        
        // If object has rotation, calculate the rotated bounding box
        if (obj.rotation && obj.rotation !== 0) {
            // Skip rotation for circular objects (numbers, circles) as they don't need it
            if (obj.type === 'numbers' || obj.type === 'circle') {
                return bounds;
            }
            
            // Calculate the center of the original bounds
            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;
            
            // Get the four corners of the original rectangle
            const corners = [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                { x: bounds.x, y: bounds.y + bounds.height }
            ];
            
            // Rotate each corner around the center
            const rotatedCorners = corners.map(corner => {
                const dx = corner.x - centerX;
                const dy = corner.y - centerY;
                return {
                    x: centerX + dx * Math.cos(obj.rotation) - dy * Math.sin(obj.rotation),
                    y: centerY + dx * Math.sin(obj.rotation) + dy * Math.cos(obj.rotation)
                };
            });
            
            // Find the axis-aligned bounding box of the rotated corners
            const xs = rotatedCorners.map(c => c.x);
            const ys = rotatedCorners.map(c => c.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            
            bounds = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        }
        
        return bounds;
    }
    
    function updateToolOptions(obj) {
        // Only show tool options for drawing tools, not for select/move tool
        if (!obj || obj.type === 'blur' || activeTool === 'select') {
             toolOptions.classList.remove('visible');
             return;
        }
        
        // Only show options when editing the object with appropriate tools
        const relevantTools = ['text', 'brush', 'rect', 'circle', 'arrow', 'numbers', 'shape', 'check', 'cross'];
        if (!relevantTools.includes(activeTool)) {
            toolOptions.classList.remove('visible');
            return;
        }
        
        toolOptions.classList.add('visible');
        colorPicker.value = obj.color;
        const sizeAttr = obj.type === 'text' ? 'size' : 'lineWidth';
        lineWidth.value = obj[sizeAttr] || obj.radius;
        
        // Sync font settings for text objects
        if (obj.type === 'text') {
            const fontFamily = document.getElementById('font-family');
            const fontSize = document.getElementById('font-size');
            const boldBtn = document.getElementById('bold-btn');
            const italicBtn = document.getElementById('italic-btn');
            const underlineBtn = document.getElementById('underline-btn');
            
            if (fontFamily) fontFamily.value = obj.family || 'Arial';
            if (fontSize) fontSize.value = obj.size || 16;
            if (boldBtn) boldBtn.classList.toggle('active', obj.bold || false);
            if (italicBtn) italicBtn.classList.toggle('active', obj.italic || false);
            if (underlineBtn) underlineBtn.classList.toggle('active', obj.underline || false);
        }
    }

    // --- Save/Copy ---
    
    function getFinalCanvas() {
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height;
        const finalCtx = finalCanvas.getContext('2d');
        
        finalCtx.drawImage(currentImage, 0, 0);
        drawingStack.filter(obj => obj.type === 'blur').forEach(obj => applyBlurEffect(finalCtx, obj));
        drawingStack.forEach(obj => drawObject(finalCtx, obj));
        return finalCanvas;
    }

    function saveImage() {
        if (!currentImage) return;
        const finalCanvas = getFinalCanvas();
        const link = document.createElement('a');
        link.download = `edited-image-${Date.now()}.png`;
        link.href = finalCanvas.toDataURL('image/png');
        link.click();
    }
    
    function copyImage() {
        if (!currentImage) return;
        const finalCanvas = getFinalCanvas();
        finalCanvas.toBlob((blob) => {
            try {
                navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch (error) {
                console.error('Failed to copy image: ', error);
            }
        }, 'image/png');
    }

    function updateCursor() {
        if (!currentImage) return;
        const cursorMap = { 
            crop: 'crosshair', 
            rect: 'crosshair', 
            circle: 'crosshair',
            arrow: 'crosshair', 
            blur: 'crosshair', 
            text: 'text',
            numbers: 'crosshair',
            eraser: 'crosshair',
            brush: 'crosshair',
            shape: 'crosshair',
            check: 'crosshair',
            cross: 'crosshair'
        };
        drawingCanvas.style.cursor = cursorMap[activeTool] || 'default';
    }

    // --- Help Dialog ---
    
    function showHelpDialog() {
        // Remove existing dialog if any
        const existingDialog = document.getElementById('help-dialog');
        if (existingDialog) existingDialog.remove();
        
        const dialog = document.createElement('div');
        dialog.id = 'help-dialog';
        dialog.innerHTML = `
            <div class="help-content">
                <div class="help-header">
                    <h3>Quick Edit - Help & Shortcuts</h3>
                    <button class="close-btn" onclick="this.closest('#help-dialog').remove()">✕</button>
                </div>
                <div class="author-info">
                    <p><strong>Created by:</strong> RTB Ruhan</p>
                    <p><strong>Website:</strong> <a href="https://rtbruhan.github.io" target="_blank">rtbruhan.github.io</a></p>
                </div>
                <div class="help-body">
                    <div class="shortcut-section">
                        <h4>🛠️ Tool Shortcuts</h4>
                        <div class="shortcut-grid">
                            <span>S</span><span>Select & Move</span>
                            <span>C</span><span>Crop</span>
                            <span>T</span><span>Text</span>
                            <span>R</span><span>Shapes (Rectangle)</span>
                            <span>A</span><span>Arrow</span>
                            <span>U</span><span>Brush</span>
                            <span>N</span><span>Numbers</span>
                            <span>B</span><span>Blur</span>
                            <span>E</span><span>Eraser</span>
                        </div>
                    </div>
                    <div class="shortcut-section">
                        <h4>⌨️ General Shortcuts</h4>
                        <div class="shortcut-grid">
                            <span>Ctrl+Z</span><span>Undo</span>
                            <span>Ctrl+Y</span><span>Redo</span>
                            <span>Delete</span><span>Delete Selected</span>
                            <span>Escape</span><span>Cancel/Deselect</span>
                            <span>Shift+Drag</span><span>Proportional Drawing</span>
                            <span>?</span><span>Show Help</span>
                        </div>
                    </div>
                    <div class="shortcut-section">
                        <h4>📝 Usage Tips</h4>
                        <ul>
                            <li>Double-click text objects to edit them</li>
                            <li>Use Select tool to move and resize objects</li>
                            <li>Change color and size in tool options</li>
                            <li>Import: Click button, drag & drop, or Ctrl+V</li>
                            <li>Click Shapes button to select Rectangle, Circle, Check, or Cross</li>
                            <li>Hold Shift while dragging for perfect squares/circles</li>
                            <li>Click without dragging to create shape with current size</li>
                            <li>Eraser removes drawn objects (click or drag over them)</li>
                            <li>Brush tool for freehand drawing</li>
                            <li>Size input shows numerical value</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Close on outside click
        setTimeout(() => {
            const handleOutsideClick = (e) => {
                if (!dialog.querySelector('.help-content').contains(e.target)) {
                    dialog.remove();
                    document.removeEventListener('click', handleOutsideClick);
                }
            };
            document.addEventListener('click', handleOutsideClick);
        }, 100);
    }

    // --- Crop Tool Functions ---
    
    function drawCropPreview() {
        if (!cropRect) return;
        
        drawingCtx.save();
        
        // Draw dark overlay
        drawingCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        drawingCtx.fillRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        
        // Clear the crop area
        drawingCtx.globalCompositeOperation = 'destination-out';
        let { x, y, width, height } = cropRect;
        if (width < 0) { x += width; width = -width; }
        if (height < 0) { y += height; height = -height; }
        drawingCtx.fillRect(x, y, width, height);
        
        // Draw crop rectangle border
        drawingCtx.globalCompositeOperation = 'source-over';
        drawingCtx.strokeStyle = '#8ab4f8';
        drawingCtx.lineWidth = 2;
        drawingCtx.setLineDash([5, 5]);
        drawingCtx.strokeRect(x, y, width, height);
        drawingCtx.setLineDash([]);
        
        drawingCtx.restore();
    }
    
    function showCropButtons() {
        const container = document.querySelector('.canvas-container');
        
        // Remove existing crop buttons if any
        const existingContainer = document.getElementById('crop-btn-container');
        if (existingContainer) existingContainer.remove();
        
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'crop-btn-container';
        
        const applyBtn = document.createElement('button');
        applyBtn.id = 'apply-crop-btn';
        applyBtn.textContent = '✓ Apply';
        applyBtn.onclick = applyCrop;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancel-crop-btn';
        cancelBtn.textContent = '✕ Cancel';
        cancelBtn.onclick = cancelCrop;
        
        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(cancelBtn);
        container.appendChild(buttonContainer);
        
        // Position buttons relative to crop area
        const rect = drawingCanvas.getBoundingClientRect();
        let { x, y, width, height } = cropRect;
        if (width < 0) { x += width; width = -width; }
        if (height < 0) { y += height; height = -height; }
        
        const btnX = x * (rect.width / drawingCanvas.width) + rect.left - container.getBoundingClientRect().left;
        const btnY = (y + height) * (rect.height / drawingCanvas.height) + rect.top - container.getBoundingClientRect().top + 10;
        
        buttonContainer.style.left = `${btnX}px`;
        buttonContainer.style.top = `${btnY}px`;
    }
    
    function applyCrop() {
        if (!cropRect || !currentImage) return;
        
        let { x, y, width, height } = cropRect;
        if (width < 0) { x += width; width = -width; }
        if (height < 0) { y += height; height = -height; }
        
        // Ensure crop area is within image bounds
        x = Math.max(0, Math.min(x, currentImage.width));
        y = Math.max(0, Math.min(y, currentImage.height));
        width = Math.min(width, currentImage.width - x);
        height = Math.min(height, currentImage.height - y);
        
        if (width <= 0 || height <= 0) {
            cancelCrop();
            return;
        }
        
        pushToUndoStack();
        
        // Create new cropped image
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw cropped portion
        tempCtx.drawImage(currentImage, x, y, width, height, 0, 0, width, height);
        
        // Apply existing blur effects in the cropped area
        const croppedBlurs = drawingStack.filter(obj => obj.type === 'blur' && 
            obj.x < x + width && obj.x + obj.width > x && 
            obj.y < y + height && obj.y + obj.height > y);
        
        croppedBlurs.forEach(blur => {
            const adjustedBlur = {
                ...blur,
                x: blur.x - x,
                y: blur.y - y
            };
            applyBlurEffect(tempCtx, adjustedBlur);
        });
        
        // Update current image
        const newImg = new Image();
        newImg.onload = () => {
            currentImage = newImg;
            
            // Adjust all drawing objects relative to crop
            drawingStack = drawingStack.filter(obj => {
                if (obj.type === 'blur') return false; // Blur effects are already applied
                
                // Adjust positions
                obj.x -= x;
                obj.y -= y;
                
                // Keep only objects that are still visible after crop
                const bounds = getObjectBounds(obj);
                return bounds.x + bounds.width > 0 && bounds.x < width && 
                       bounds.y + bounds.height > 0 && bounds.y < height;
            });
            
            resetCanvas();
            cancelCrop();
        };
        newImg.src = tempCanvas.toDataURL();
    }
    
    function cancelCrop() {
        isCropping = false;
        cropRect = null;
        const existingContainer = document.getElementById('crop-btn-container');
        if (existingContainer) existingContainer.remove();
        redrawAnnotations();
    }

    // Helper function to build text font string
    function getTextFont(obj) {
        let fontStr = '';
        if (obj.bold) fontStr += 'bold ';
        if (obj.italic) fontStr += 'italic ';
        fontStr += `${obj.size}px `;
        fontStr += obj.family || 'Arial';
        return fontStr;
    }
}); 