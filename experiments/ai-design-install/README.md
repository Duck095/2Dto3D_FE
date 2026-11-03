# AI Design Install Demo

Isolated prototype and Three.js smoke example. The demo is not part of the production router and does not replace any production page.

## Run

From `2Dto3D_FE`, start Vite with this folder as its root:

```powershell
node_modules\.bin\vite.cmd --config experiments\ai-design-install\vite.config.js --host 127.0.0.1 --port 3001
```

Open `http://127.0.0.1:3001/` and select a part, toggle the assembly view, or drag the model to orbit. Open `/threeui.html` for the isolated ThreeUI Community component check.

The example uses the app's existing React, Three.js, React Three Fiber, and Drei packages. It does not add GSAP or edit the application entry point.
