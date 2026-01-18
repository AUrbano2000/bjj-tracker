let connectMode = false;
let firstSelectedMove = null;
const modeIndicator = document.getElementById("mode-indicator");

// Toggle function for button click
function toggleConnectMode() {
  connectMode = !connectMode;
  firstSelectedMove = null;
  
  if (connectMode) {
    modeIndicator.textContent = "Connect Mode (Click 2 moves)";
    modeIndicator.classList.add("active");
    document.querySelectorAll(".move").forEach(m => m.classList.remove("connecting"));
  } else {
    modeIndicator.textContent = "Drag Mode (Click to Connect)";
    modeIndicator.classList.remove("active");
  }
}

// Toggle between drag and connect mode with keyboard
document.addEventListener("keydown", e => {
  if (e.key.toLowerCase() === "c") {
    toggleConnectMode();
  }
});

// Update line positions
function updateLines() {
  document.querySelectorAll(".connection-line").forEach(line => {
    const fromId = line.dataset.from;
    const toId = line.dataset.to;
    
    const fromMove = document.querySelector(`[data-id="${fromId}"]`);
    const toMove = document.querySelector(`[data-id="${toId}"]`);
    
    if (fromMove && toMove) {
      const fromRect = fromMove.getBoundingClientRect();
      const toRect = toMove.getBoundingClientRect();
      const canvas = document.getElementById("canvas").getBoundingClientRect();
      
      const x1 = fromRect.left - canvas.left + fromRect.width / 2;
      const y1 = fromRect.top - canvas.top + fromRect.height / 2;
      const x2 = toRect.left - canvas.left + toRect.width / 2;
      const y2 = toRect.top - canvas.top + toRect.height / 2;
      
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
    }
  });
}

// Add click handlers to lines for deletion
function setupLineClickHandlers() {
  document.querySelectorAll(".connection-line").forEach(line => {
    line.addEventListener("click", (e) => {
      e.stopPropagation();
      if (confirm("Delete this connection?")) {
        const fromId = line.dataset.from;
        const toId = line.dataset.to;
        
        fetch("/delete_transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_move_id: fromId,
            to_move_id: toId
          })
        }).then(() => {
          line.remove();
        });
      }
    });
  });
}

// Initial line positioning
updateLines();
setupLineClickHandlers();

document.querySelectorAll(".move").forEach(move => {
  let offsetX, offsetY, dragging = false;
  let longPressTimer = null;
  let longPressPopup = null;
  let hasMoved = false;

  // Helper to get position from mouse or touch event
  function getEventPosition(e) {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }

  function showLongPressPopup() {
    longPressPopup = document.createElement('div');
    longPressPopup.style.position = 'fixed';
    longPressPopup.style.top = '50%';
    longPressPopup.style.left = '50%';
    longPressPopup.style.transform = 'translate(-50%, -50%)';
    longPressPopup.style.background = '#0066cc';
    longPressPopup.style.color = 'white';
    longPressPopup.style.padding = '15px 25px';
    longPressPopup.style.borderRadius = '8px';
    longPressPopup.style.fontSize = '16px';
    longPressPopup.style.zIndex = '10000';
    longPressPopup.textContent = 'Hold to delete move';
    document.body.appendChild(longPressPopup);
  }

  function removeLongPressPopup() {
    if (longPressPopup) {
      longPressPopup.remove();
      longPressPopup = null;
    }
  }

  function handleStart(e) {
    hasMoved = false;
    
    if (connectMode) {
      // Connect mode: select moves to connect
      e.preventDefault();
      
      if (!firstSelectedMove) {
        firstSelectedMove = move;
        move.classList.add("connecting");
      } else if (firstSelectedMove !== move) {
        const fromId = firstSelectedMove.dataset.id;
        const toId = move.dataset.id;
        
        // Create transition
        fetch("/create_transition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_move_id: fromId,
            to_move_id: toId
          })
        }).then(() => {
          // Add line to DOM
          const svg = document.getElementById("lines-layer");
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.classList.add("connection-line");
          line.dataset.from = fromId;
          line.dataset.to = toId;
          svg.appendChild(line);
          updateLines();
          setupLineClickHandlers();
        });
        
        firstSelectedMove.classList.remove("connecting");
        firstSelectedMove = null;
      }
    } else {
      // Drag mode
      dragging = true;
      const pos = getEventPosition(e);
      const canvas = document.getElementById("canvas").getBoundingClientRect();
      offsetX = pos.clientX - move.getBoundingClientRect().left;
      offsetY = pos.clientY - move.getBoundingClientRect().top;
      e.preventDefault();

      // Start long press timer
      showLongPressPopup();
      longPressTimer = setTimeout(() => {
        removeLongPressPopup();
        // Remove from map (hide it)
        move.style.display = 'none';
        dragging = false;
      }, 3000);
    }
  }

  function handleMove(e) {
    if (!dragging) return;
    hasMoved = true;
    e.preventDefault();

    // Cancel long press if user starts dragging
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      removeLongPressPopup();
      longPressTimer = null;
    }

    const pos = getEventPosition(e);
    const canvas = document.getElementById("canvas").getBoundingClientRect();
    move.style.left = (pos.clientX - canvas.left - offsetX) + "px";
    move.style.top = (pos.clientY - canvas.top - offsetY) + "px";
    updateLines();
  }

  function handleEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      removeLongPressPopup();
      longPressTimer = null;
    }

    if (!dragging) return;
    dragging = false;

    if (hasMoved) {
      fetch("/save_position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: move.dataset.id,
          x: parseInt(move.style.left),
          y: parseInt(move.style.top)
        })
      });
    }
  }

  // Mouse events
  move.addEventListener("mousedown", handleStart);
  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", handleEnd);

  // Touch events
  move.addEventListener("touchstart", handleStart);
  document.addEventListener("touchmove", handleMove, { passive: false });
  document.addEventListener("touchend", handleEnd);
});
