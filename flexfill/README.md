# Flexfill 3D Showroom — v10

Open `dist/index.html` via a static HTTP server, or use https://johnnymilk.github.io/design-playground/flexfill/dist/ .

本版修正：充填站右移至打膠塞站旁，兩站中心相距21 mm（模型設計值）；充填HMI同步移至該區正前方。取紙後於共同升降台上升；充填及打膠塞後沿上層退回同一座升降台，再下降至下層，往右經斜坡出料。移除加塞站附近的獨立下降機構。

## Rebuild

```sh
python -m pip install -r requirements.txt
python build_model.py
python -m http.server 8000 --directory dist
```

`dist/assets/` contains the display GLB, editable model data, 11 printable STL parts, validation results and v10 download kit. `build_model.py` regenerates geometry and validates the parts; the downloadable ZIP is a versioned snapshot.

The mechanism is illustrative, based on user descriptions. Dimensions are approximate, not OEM CAD. Print parts have not been physically test-printed. See `dist/assets/README.txt` for assumptions and revision history.
