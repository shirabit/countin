/**
 * Line Manager
 *
 * Handles creation, visualization, and management of counting lines.
 * Detects when people cross these lines.
 */
class LineManager {
    constructor(canvas) {
        // Canvas for line drawing
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Line state
        this.lines = [];
        this.nextLineId = 1;
        this.lineCrossings = {};

        // Drawing state
        this.isDrawingEnabled = false;
        this.isDrawing = false;
        this.drawingLine = null;
        this.lastLineColor = this.getRandomColor();

        // Default line names
        this.defaultLineNames = ['North Entrance', 'South Exit', 'Main Door', 'Side Entrance', 'Emergency Exit'];

        // Track crossings to prevent duplicate counts
        this.crossedTracks = new Map();

        // Event callbacks
        this.onLineAdded = null;
        this.onLineRemoved = null;
        this.onLinesCleared = null;
        this.onLineCrossed = null;

        // Initialize line manager
        this.init();
    }

    /**
     * Initialize the line manager
     */
    init() {
        // Add event listeners to canvas
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Add touch support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        console.log('Line manager initialized');
    }

    /**
     * Enable line drawing mode
     */
    enableDrawing() {
        this.isDrawingEnabled = true;
        this.canvas.style.cursor = 'crosshair';

        // Add drawing-active class to body for CSS styling
        document.body.classList.add('drawing-active');

        console.log('Line drawing enabled');
    }

    /**
     * Disable line drawing mode
     */
    disableDrawing() {
        this.isDrawingEnabled = false;
        this.isDrawing = false;
        this.drawingLine = null;
        this.canvas.style.cursor = 'default';

        // Remove drawing-active class from body
        document.body.classList.remove('drawing-active');

        // Redraw all lines to clear any unfinished line
        this.redrawLines();

        console.log('Line drawing disabled');
    }

    /**
     * Get lines
     * @returns {Array} Array of line objects
     */
    getLines() {
        return [...this.lines];
    }

    /**
     * Get line crossings
     * @returns {Object} Line crossing counts
     */
    getLineCrossings() {
        return {...this.lineCrossings};
    }

    /**
     * Add a new line
     * @param {Object} line - Line object with start and end points
     * @returns {Object} The added line with ID
     */
    addLine(line) {
        // Generate line ID
        const lineId = this.nextLineId++;

        // Calculate line orientation
        const isVertical = Math.abs(line.end.x - line.start.x) < Math.abs(line.end.y - line.start.y);
        const orientation = isVertical ? 'vertical' : 'horizontal';

        // Generate line name if not provided
        const name = line.name || this.generateLineName(orientation);

        // Generate color if not provided
        const color = line.color || this.getRandomColor();

        // Initialize crossing counts
        this.lineCrossings[lineId] = { in: 0, out: 0 };

        // Create line object
        const newLine = {
            id: lineId,
            start: { ...line.start },
            end: { ...line.end },
            name,
            color,
            orientation
        };

        // Add to lines array
        this.lines.push(newLine);

        // Trigger callback if exists
        if (this.onLineAdded) {
            this.onLineAdded(newLine);
        }

        // Redraw lines
        this.redrawLines();

        console.log(`Added line: ${name} (${orientation})`, newLine);

        return newLine;
    }

    /**
     * Remove a line by ID
     * @param {number} lineId - Line ID to remove
     * @returns {boolean} True if line was removed
     */
    removeLine(lineId) {
        const lineIndex = this.lines.findIndex(line => line.id === lineId);

        if (lineIndex !== -1) {
            const removedLine = this.lines[lineIndex];

            // Remove from lines array
            this.lines.splice(lineIndex, 1);

            // Delete crossing counts
            delete this.lineCrossings[lineId];

            // Remove from crossedTracks map
            for (const key of this.crossedTracks.keys()) {
                if (key.includes(`-${lineId}`)) {
                    this.crossedTracks.delete(key);
                }
            }

            // Trigger callback if exists
            if (this.onLineRemoved) {
                this.onLineRemoved(removedLine);
            }

            // Redraw lines
            this.redrawLines();

            console.log(`Removed line: ${removedLine.name}`);

            return true;
        }

        return false;
    }

    /**
     * Clear all lines
     */
    clearLines() {
        // Save current lines for callback
        const oldLines = [...this.lines];

        // Clear lines array
        this.lines = [];

        // Clear crossings
        this.lineCrossings = {};

        // Clear the tracking of already crossed tracks
        this.crossedTracks.clear();

        // Clear canvas
        this.redrawLines();

        // Trigger callback if exists
        if (this.onLinesCleared && oldLines.length > 0) {
            this.onLinesCleared(oldLines);
        }

        console.log('All lines cleared');
    }

    /**
     * Rename a line
     * @param {number} lineId - Line ID to rename
     * @param {string} newName - New line name
     * @returns {boolean} True if line was renamed
     */
    renameLine(lineId, newName) {
        const line = this.lines.find(line => line.id === lineId);

        if (line) {
            const oldName = line.name;
            line.name = newName;

            // Redraw to update the line name
            this.redrawLines();

            console.log(`Renamed line from "${oldName}" to "${newName}"`);
            return true;
        }

        return false;
    }

    /**
     * Reset all line crossing counts
     */
    resetCounts() {
        // Reset all line crossings
        for (const lineId in this.lineCrossings) {
            this.lineCrossings[lineId] = { in: 0, out: 0 };
        }

        // Clear the tracking of already crossed tracks
        this.crossedTracks.clear();

        console.log('All line crossing counts reset');
    }

    /**
     * Check for line crossings when a tracked object moves
     * @param {Object} person - Person object with ID
     * @param {Array} prevPos - Previous position [x, y]
     * @param {Array} currentPos - Current position [x, y]
     */
    checkLineCrossings(person, prevPos, currentPos) {
        if (!person || !person.id || !prevPos || !currentPos) return;

        // Check crossing for each line
        for (const line of this.lines) {
            // Get line points
            const lineStart = [line.start.x, line.start.y];
            const lineEnd = [line.end.x, line.end.y];

            // Check if the trajectory crosses the line
            const intersection = this.lineIntersection(
                prevPos, currentPos,
                lineStart, lineEnd
            );

            // If no intersection, continue to next line
            if (!intersection) continue;

            // Create a unique key for this person-line pair
            const crossingKey = `${person.id}-${line.id}`;

            // If we already counted this crossing recently, skip it
            const lastCrossing = this.crossedTracks.get(crossingKey);
            const now = Date.now();

            if (lastCrossing && (now - lastCrossing.timestamp) < 2000) {
                // Skip if crossed within the last 2 seconds
                console.log(`Skipping duplicate crossing of ${crossingKey}`);
                continue;
            }

            // Determine crossing direction
            const direction = this.determineLineCrossingDirection(
                prevPos, currentPos,
                lineStart, lineEnd
            );

            // Update count for this line
            if (!this.lineCrossings[line.id]) {
                this.lineCrossings[line.id] = { in: 0, out: 0 };
            }

            this.lineCrossings[line.id][direction]++;

            // Remember this crossing to prevent duplicates
            this.crossedTracks.set(crossingKey, {
                timestamp: now,
                direction
            });

            // Create crossing event
            const crossingEvent = {
                lineId: line.id,
                lineName: line.name,
                personId: person.id,
                direction,
                position: intersection,
                timestamp: now
            };

            console.log(`Person ${person.id} crossed ${line.name} going ${direction}`, crossingEvent);

            // Trigger callback if exists
            if (this.onLineCrossed) {
                this.onLineCrossed(crossingEvent);
            }
        }
    }

    /**
     * Check if two line segments intersect
     * @param {Array} p1 - First line start point [x, y]
     * @param {Array} p2 - First line end point [x, y]
     * @param {Array} p3 - Second line start point [x, y]
     * @param {Array} p4 - Second line end point [x, y]
     * @returns {Array|null} Intersection point or null
     */
    lineIntersection(p1, p2, p3, p4) {
        // Convert points from array to x,y for readability
        const [x1, y1] = p1;
        const [x2, y2] = p2;
        const [x3, y3] = p3;
        const [x4, y4] = p4;

        // Calculate the denominator
        const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

        // Lines are parallel if denominator is 0
        if (Math.abs(denominator) < 0.0001) {
            return null;
        }

        // Calculate intersection parameters
        const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
        const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

        // Check if intersection occurs within both line segments
        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
            return null;
        }

        // Calculate the intersection point
        const x = x1 + ua * (x2 - x1);
        const y = y1 + ua * (y2 - y1);

        return [x, y];
    }

    /**
     * Determine direction of line crossing
     * @param {Array} p1 - Track previous position [x, y]
     * @param {Array} p2 - Track current position [x, y]
     * @param {Array} lineStart - Line start point [x, y]
     * @param {Array} lineEnd - Line end point [x, y]
     * @returns {string} Direction ('in' or 'out')
     */
    determineLineCrossingDirection(p1, p2, lineStart, lineEnd) {
        // Calculate which side of the line each point is on
        const getSide = (px, py, x1, y1, x2, y2) => {
            return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
        };

        const prevSide = getSide(
            p1[0], p1[1],
            lineStart[0], lineStart[1],
            lineEnd[0], lineEnd[1]
        );

        const currSide = getSide(
            p2[0], p2[1],
            lineStart[0], lineStart[1],
            lineEnd[0], lineEnd[1]
        );

        // Line orientation affects what we consider "in" vs "out"
        const dx = lineEnd[0] - lineStart[0];
        const dy = lineEnd[1] - lineStart[1];

        // Determine if line is more vertical or horizontal
        const isVertical = Math.abs(dx) < Math.abs(dy);

        if (isVertical) {
            // For vertical lines:
            // Crossing from left to right is "in" (negative to positive)
            // Crossing from right to left is "out" (positive to negative)
            return prevSide <= 0 && currSide > 0 ? 'in' : 'out';
        } else {
            // For horizontal lines:
            // Crossing from top to bottom is "in" (negative to positive)
            // Crossing from bottom to top is "out" (positive to negative)
            return prevSide <= 0 && currSide > 0 ? 'in' : 'out';
        }
    }

    /**
     * Generate a name for a new line
     * @param {string} orientation - Line orientation ('vertical' or 'horizontal')
     * @returns {string} Generated line name
     */
    generateLineName(orientation) {
        // Count existing lines
        const count = this.lines.length;

        // Use default name if available
        if (count < this.defaultLineNames.length) {
            return this.defaultLineNames[count];
        }

        // Otherwise, generate a generic name
        return `${orientation.charAt(0).toUpperCase() + orientation.slice(1)} Line ${count + 1}`;
    }

    /**
     * Generate a random color for a line
     * @returns {string} Random color in hex format
     */
    getRandomColor() {
        // Generate a color that's easy to see
        const colors = [
            '#FF5733', // Red-Orange
            '#33FF57', // Green
            '#3357FF', // Blue
            '#FF33F5', // Pink
            '#F5FF33', // Yellow
            '#33FFF5', // Cyan
            '#FF5733', // Orange
            '#8333FF', // Purple
            '#FF3333', // Red
            '#33FF33'  // Lime
        ];

        // Pick a random color from the list
        const randomIndex = Math.floor(Math.random() * colors.length);
        this.lastLineColor = colors[randomIndex];

        return this.lastLineColor;
    }

    /**
     * Resize canvas and redraw lines
     */
    resizeCanvas() {
        this.redrawLines();
    }

    /**
     * Redraw all lines on the canvas
     */
    redrawLines() {
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each line
        for (const line of this.lines) {
            this.drawLine(line);
        }

        // Draw current drawing line if exists
        if (this.isDrawing && this.drawingLine) {
            this.drawLine(this.drawingLine, true);
        }
    }

    /**
     * Draw a single line on the canvas
     * @param {Object} line - Line object to draw
     * @param {boolean} isDrawing - Whether this is a line being drawn
     */
    drawLine(line, isDrawing = false) {
        const { start, end, color } = line;

        // Draw the line
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Draw endpoints
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = color;
        this.ctx.fill();

        // If not actively drawing, add a label
        if (!isDrawing) {
            // Draw line name
            this.ctx.font = '14px Arial';
            this.ctx.fillStyle = color;

            // Position the text in the middle of the line
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            // Add a white background for better visibility
            const textMetrics = this.ctx.measureText(line.name);
            const textWidth = textMetrics.width;
            const textHeight = 14; // Approximate height for standard font

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.fillRect(
                midX - textWidth / 2 - 5,
                midY - textHeight / 2 - 5,
                textWidth + 10,
                textHeight + 10
            );

            // Draw the text
            this.ctx.fillStyle = color;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(line.name, midX, midY);

            // Draw direction indicators
            this.drawDirectionIndicator(line);
        }
    }

    /**
     * Draw direction indicators on a line
     * @param {Object} line - Line object
     */
    drawDirectionIndicator(line) {
        const { start, end, color } = line;

        // Calculate line direction vector
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // Normalize the vector
        const length = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / length;
        const ny = dy / length;

        // Calculate perpendicular vector (for arrow wings)
        const px = -ny;
        const py = nx;

        // Calculate midpoint
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;

        // Draw 'in' direction arrow (inward pointing)
        const inPointX = midX - nx * 15; // Point on the line
        const inArrow1X = inPointX + nx * 10 + px * 5;
        const inArrow1Y = midY - ny * 15 + py * 5;
        const inArrow2X = inPointX + nx * 10 - px * 5;
        const inArrow2Y = midY - ny * 15 - py * 5;

        this.ctx.beginPath();
        this.ctx.moveTo(inPointX, midY - ny * 15);
        this.ctx.lineTo(inArrow1X, inArrow1Y);
        this.ctx.lineTo(inArrow2X, inArrow2Y);
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();

        // Draw 'out' direction arrow (outward pointing)
        const outPointX = midX + nx * 15; // Point on the line
        const outArrow1X = outPointX - nx * 10 + px * 5;
        const outArrow1Y = midY + ny * 15 + py * 5;
        const outArrow2X = outPointX - nx * 10 - px * 5;
        const outArrow2Y = midY + ny * 15 - py * 5;

        this.ctx.beginPath();
        this.ctx.moveTo(outPointX, midY + ny * 15);
        this.ctx.lineTo(outArrow1X, outArrow1Y);
        this.ctx.lineTo(outArrow2X, outArrow2Y);
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    /**
     * Handle mouse down event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseDown(event) {
        if (!this.isDrawingEnabled) return;

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        console.log('Mouse down at', x, y);

        // Start drawing
        this.isDrawing = true;
        this.drawingLine = {
            start: { x, y },
            end: { x, y }, // Initially the same as start
            color: this.getRandomColor()
        };

        this.redrawLines();
    }

    /**
     * Handle mouse move event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseMove(event) {
        if (!this.isDrawing) return;

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Update end point of drawing line
        this.drawingLine.end = { x, y };

        // Redraw
        this.redrawLines();
    }

    /**
     * Handle mouse up event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseUp(event) {
        if (!this.isDrawing) return;

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        console.log('Mouse up at', x, y);

        // Update end point
        this.drawingLine.end = { x, y };

        // Check if line is long enough to be valid
        const dx = this.drawingLine.end.x - this.drawingLine.start.x;
        const dy = this.drawingLine.end.y - this.drawingLine.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length >= 20) {
            // Add the line
            this.addLine(this.drawingLine);
            console.log('Line added through mouse interaction');
        } else {
            console.log('Line too short, discarding');
        }

        // End drawing
        this.isDrawing = false;
        this.drawingLine = null;

        // Redraw
        this.redrawLines();
    }

    /**
     * Handle mouse leave event
     * @param {MouseEvent} event - Mouse event
     */
    handleMouseLeave(event) {
        if (!this.isDrawing) return;

        // Cancel drawing
        this.isDrawing = false;
        this.drawingLine = null;

        // Redraw
        this.redrawLines();
    }

    /**
     * Handle touch start event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchStart(event) {
        if (!this.isDrawingEnabled) return;

        // Prevent default to avoid scrolling
        event.preventDefault();

        const touch = event.touches[0];

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Start drawing
        this.isDrawing = true;
        this.drawingLine = {
            start: { x, y },
            end: { x, y }, // Initially the same as start
            color: this.getRandomColor()
        };

        this.redrawLines();
    }

    /**
     * Handle touch move event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchMove(event) {
        if (!this.isDrawing) return;

        // Prevent default to avoid scrolling
        event.preventDefault();

        const touch = event.touches[0];

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Update end point of drawing line
        this.drawingLine.end = { x, y };

        // Redraw
        this.redrawLines();
    }

    /**
     * Handle touch end event
     * @param {TouchEvent} event - Touch event
     */
    handleTouchEnd(event) {
        if (!this.isDrawing) return;

        // Check if line is long enough to be valid
        const dx = this.drawingLine.end.x - this.drawingLine.start.x;
        const dy = this.drawingLine.end.y - this.drawingLine.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length >= 20) {
            // Add the line
            this.addLine(this.drawingLine);
        } else {
            console.log('Line too short, discarding');
        }

        // End drawing
        this.isDrawing = false;
        this.drawingLine = null;

        // Redraw
        this.redrawLines();
    }
}