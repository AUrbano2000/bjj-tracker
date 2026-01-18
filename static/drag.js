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
  let showPopupTimer = null;
  let longPressPopup = null;
  let progressDial = null;
  let hasMoved = false;
  let startX = 0, startY = 0;

  // Helper to get position from mouse or touch event
  function getEventPosition(e) {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }

  function showLongPressPopup() {
    const rect = move.getBoundingClientRect();
    longPressPopup = document.createElement('div');
    longPressPopup.style.position = 'fixed';
    longPressPopup.style.left = rect.left + rect.width / 2 + 'px';
    longPressPopup.style.top = (rect.top - 50) + 'px';
    longPressPopup.style.transform = 'translateX(-50%)';
    longPressPopup.style.background = '#0066cc';
    longPressPopup.style.color = 'white';
    longPressPopup.style.padding = '8px 16px';
    longPressPopup.style.borderRadius = '6px';
    longPressPopup.style.fontSize = '14px';
    longPressPopup.style.zIndex = '10000';
    longPressPopup.style.whiteSpace = 'nowrap';
    
    // Check if in delete mode (check if the mode button text is "Delete Mode")
    const modeBtn = document.getElementById('modeToggleButton');
    const isDeleteMode = modeBtn && modeBtn.textContent === 'Delete Mode';
    
    if (isDeleteMode) {
      longPressPopup.textContent = 'Hold to delete this move';
      longPressPopup.style.background = '#ff4444';
    } else {
      longPressPopup.textContent = 'Hold to open up information';
      longPressPopup.style.background = '#0066cc';
    }
    
    document.body.appendChild(longPressPopup);

    // Create progress dial
    progressDial = document.createElement('div');
    progressDial.style.position = 'fixed';
    progressDial.style.left = rect.left + rect.width / 2 + 'px';
    progressDial.style.top = rect.top + rect.height / 2 + 'px';
    progressDial.style.transform = 'translate(-50%, -50%)';
    progressDial.style.width = '60px';
    progressDial.style.height = '60px';
    progressDial.style.borderRadius = '50%';
    progressDial.style.border = '4px solid rgba(255, 255, 255, 0.3)';
    progressDial.style.borderTop = '4px solid white';
    progressDial.style.zIndex = '10001';
    progressDial.style.animation = 'spin 2.5s linear';
    progressDial.style.pointerEvents = 'none';
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
    `;
    if (!document.querySelector('style[data-spin-animation]')) {
      style.setAttribute('data-spin-animation', 'true');
      document.head.appendChild(style);
    }
    
    document.body.appendChild(progressDial);
  }

  function removeLongPressPopup() {
    if (longPressPopup) {
      longPressPopup.remove();
      longPressPopup = null;
    }
    if (progressDial) {
      progressDial.remove();
      progressDial = null;
    }
  }

  function handleStart(e) {
    // Don't start dragging if clicking on form elements
    const target = e.target || e.touches?.[0]?.target;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.tagName === 'BUTTON')) {
      return;
    }
    
    hasMoved = false;
    const pos = getEventPosition(e);
    startX = pos.clientX;
    startY = pos.clientY;
    
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
      const canvas = document.getElementById("canvas").getBoundingClientRect();
      offsetX = pos.clientX - move.getBoundingClientRect().left;
      offsetY = pos.clientY - move.getBoundingClientRect().top;
      e.preventDefault();

      // Start timer to show popup after 0.35s
      showPopupTimer = setTimeout(() => {
        if (!hasMoved) {
          showLongPressPopup();
          // Start long press timer
          longPressTimer = setTimeout(() => {
            removeLongPressPopup();
            
            // Check if in delete mode
            const modeBtn = document.getElementById('modeToggleButton');
            const isDeleteMode = modeBtn && modeBtn.textContent === 'Delete Mode';
            
            if (isDeleteMode) {
              // Delete the move from the database
              const moveId = move.dataset.id;
              fetch('/delete_move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ move_id: moveId })
              }).then(() => {
                move.remove();
              });
            } else {
              // Open move profile (navigate like a link)
              const moveName = move.querySelector('.move-name').textContent;
              window.location.href = `/move_profile/${encodeURIComponent(moveName)}`;
            }
            
            dragging = false;
          }, 1650); // 1.65 more seconds after popup shows (2s total)
        }
      }, 350);
    }
  }

  function handleMove(e) {
    if (!dragging) return;
    
    // Don't interfere with form elements
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
      return;
    }
    
    e.preventDefault();

    const pos = getEventPosition(e);
    const distance = Math.sqrt(Math.pow(pos.clientX - startX, 2) + Math.pow(pos.clientY - startY, 2));
    
    // If moved more than 20px, cancel long press
    if (distance > 20) {
      hasMoved = true;
      if (showPopupTimer) {
        clearTimeout(showPopupTimer);
        showPopupTimer = null;
      }
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        removeLongPressPopup();
        longPressTimer = null;
      }
    }

    const canvas = document.getElementById("canvas").getBoundingClientRect();
    move.style.left = (pos.clientX - canvas.left - offsetX) + "px";
    move.style.top = (pos.clientY - canvas.top - offsetY) + "px";
    updateLines();
  }

  function handleEnd() {
    if (showPopupTimer) {
      clearTimeout(showPopupTimer);
      showPopupTimer = null;
    }
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
