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

  move.addEventListener("mousedown", e => {
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
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    }
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;

    move.style.left = e.pageX - offsetX + "px";
    move.style.top  = e.pageY - offsetY + "px";
    updateLines();
  });

  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;

    fetch("/save_position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: move.dataset.id,
        x: parseInt(move.style.left),
        y: parseInt(move.style.top)
      })
    });
  });
});
