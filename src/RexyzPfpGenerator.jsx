// === RexyzPfpGenerator.jsx ===
import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Save,
  RotateCcw,
  PlusCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as htmlToImage from "html-to-image";

/*
  Генератор PFP
  - Body: базовые слои (body, hands, eyes, mouth, brows)
  - Attributes: аксессуары (hats, masks, other, effects)
  - Background: фон
  - activeAttrs: массив добавленных аксессуаров (каждый можно двигать, вращать, масштабировать)
*/

const LAYER_ORDER = [
  "bg",
  "body",
  "eyes",
  "mouth",
  "brows",
  "hats",
  "masks",
  "other",
  "effects",
];

// Основные группы и варианты (оставлены пути на /assets, как в оригинале)
const GROUPS = {
  Body: [
    { id: "body", label: "Body", variants: ["/assets/body1.png"] },
    {
      id: "eyes",
      label: "Eyes",
      variants: [
        "/assets/eyes1.png",
        "/assets/eyes2.png",
        "/assets/eyes3.png",
        "/assets/eyes4.png",
        "/assets/eyes5.png",
        "/assets/eyes6.png",
        "/assets/eyes7.png",
        "/assets/eyes8.png",
        "/assets/eyes9.png",
        "/assets/eyes10.png",
      ],
    },
    {
      id: "mouth",
      label: "Mouth",
      variants: [
        "/assets/mouth1.png",
        "/assets/mouth2.png",
        "/assets/mouth3.png",
        "/assets/mouth4.png",
        "/assets/mouth5.png",
        "/assets/mouth6.png",
        "/assets/mouth7.png",
        "/assets/mouth8.png",
        "/assets/mouth9.png",
        "/assets/mouth10.png",
        "/assets/mouth11.png",
        "/assets/mouth12.png",
      ],
    },
    {
      id: "brows",
      label: "Eyebrows",
      variants: [
        "/assets/brows1.png",
        "/assets/brows2.png",
        "/assets/brows3.png",
        "/assets/brows4.png",
        "/assets/brows5.png",
        "/assets/brows6.png",
        "/assets/brows7.png",
        "/assets/brows8.png",
        "/assets/brows9.png",
        "/assets/brows10.png",
        "/assets/brows11.png",
      ],
    },
  ],
  Attributes: [
    {
      id: "hats",
      label: "Hats",
      variants: [
        "/assets/hat1.png",
        "/assets/hat2.png",
        "/assets/hat3.png",
        "/assets/hat4.png",
        "/assets/hat5.png",
        "/assets/hat6.png",
        "/assets/hat7.png",
        "/assets/hat8.png",
      ],
    },
    {
      id: "masks",
      label: "Masks",
      variants: ["/assets/mask1.png"],
    },
    {
      id: "other",
      label: "Other",
      variants: ["/assets/other1.png"],
    },
    {
      id: "effects",
      label: "Effects",
      variants: [
        "/assets/effect1.png",
        "/assets/effect2.png",
        "/assets/effect3.png",
        "/assets/effect4.png",
      ],
    },
  ],
  Background: [
    {
      id: "bg",
      label: "Background",
      variants: ["/assets/bg1.png", "/assets/bg2.png", "/assets/bg3.png", "/assets/bg4.png", "/assets/bg5.png", "/assets/bg6.png", "/assets/bg7.png", "/assets/bg8.png", "/assets/bg9.png", "/assets/bg10.png", "/assets/bg11.png", "/assets/bg12.png", "/assets/bg13.png"],
    },
  ],
};

function getInitialLayers() {
  const initial = {};
  Object.values(GROUPS)
    .flat()
    .forEach((item, idx) => {
      if (["hats", "masks", "other", "effects"].includes(item.id)) return;
      const defaultZ = LAYER_ORDER.indexOf(item.id);
      initial[item.id] = {
        variant: 0,
        z: defaultZ >= 0 ? defaultZ : LAYER_ORDER.length + idx,
        scale: 1,
        rotate: 0,
        x: 0,
        y: 0,
        visible: true,
      };
    });
  return initial;
}

export default function RexyzPfpGenerator() {
  // Генераторные стейты
  const [layers, setLayers] = useState(getInitialLayers());
  const [tab, setTab] = useState("Body"); // Body | Attributes | Background (внутри генератора)
  const [gallery, setGallery] = useState([]); // массив dataUrl
  const [activeAttrs, setActiveAttrs] = useState([]); // добавленные аксессуары
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  // Навигация верхней панели: view = 'home' | 'gallery'
  const [view, setView] = useState("home");

  const canvasRef = useRef(null);

  // Изменения слоя (body/eyes/mouth/brows/bg)
  const updateLayer = (id, changes) => {
    setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...changes } }));
  };

  // Добавление аттрибута (из вкладки Attributes)
  const addAttribute = (sourceId = selectedCategory, variant = selectedIndex) => {
    if (!sourceId) return;
    const maxBaseZ = Math.max(...Object.values(layers).map((l) => l.z));
    const maxAttrZ = activeAttrs.length
      ? Math.max(...activeAttrs.map((a) => a.z))
      : maxBaseZ;
    const nextZ = Math.max(maxBaseZ, maxAttrZ) + 1;

    const newAttr = {
      id: `${sourceId}-${Date.now()}`,
      sourceId,
      variant,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      z: nextZ,
      visible: true,
    };
    setActiveAttrs((prev) => [...prev, newAttr]);
  };

  const updateAttr = (id, changes) => {
    setActiveAttrs((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...changes } : a))
    );
  };

  const removeAttr = (id) => {
    setActiveAttrs((prev) => prev.filter((a) => a.id !== id));
  };

  // Возвращает массив вариантов по sourceId (hats/masks/etc)
  const getVariantsFor = (sourceId) => {
    const found = Object.values(GROUPS).flat().find((it) => it.id === sourceId);
    return found ? found.variants : [];
  };

  // Скачать текущее содержимое канваса в PNG
  const downloadPng = async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 3,
      });
      const link = document.createElement("a");
      link.download = `rexyz-pfp-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

  // Сохранить в локальную галерею (localStorage)
  const saveToGallery = async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      setGallery((prev) => [dataUrl, ...prev]); // сохранение в начало
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  // Загрузка галереи из localStorage при старте
  useEffect(() => {
    const saved = localStorage.getItem("rexyzGallery");
    if (saved) {
      try {
        setGallery(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed parsing saved gallery", e);
      }
    }
  }, []);

  // Синхронизация галереи в localStorage
  useEffect(() => {
    try {
      localStorage.setItem("rexyzGallery", JSON.stringify(gallery));
    } catch (e) {
      console.warn("Failed saving gallery", e);
    }
  }, [gallery]);

  const handleResetAll = () => {
    setLayers(getInitialLayers());
    setActiveAttrs([]);
    setSelectedCategory(null);
    setSelectedIndex(0);
    setResetKey((k) => k + 1);
  };

  // Список для рендера: базовые слои + атрибуты, отсортированные по z
  const combinedRenderList = () => {
    const baseItems = Object.values(GROUPS)
      .flat()
      .filter((it) => !["hats", "masks", "other", "effects"].includes(it.id))
      .map((item) => {
        const l = layers[item.id];
        return {
          type: "base",
          id: item.id,
          item,
          l,
          z: l?.z ?? 0,
        };
      })
      .filter((it) => it.l && it.l.visible);

    const attrItems = activeAttrs
      .filter((a) => a.visible)
      .map((a) => ({
        type: "attr",
        id: a.id,
        attr: a,
        z: a.z,
      }));

    return [...baseItems, ...attrItems].sort((A, B) => (A.z ?? 0) - (B.z ?? 0));
  };

  // Скачать картинку из галереи по dataUrl
  const downloadFromGallery = (dataUrl, idx) => {
    const link = document.createElement("a");
    link.download = `rexyz-gallery-${idx}-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Удалить картинку из галереи
  const removeFromGallery = (idx) => {
    setGallery((prev) => prev.filter((_, i) => i !== idx));
  };

  // Очистить галерею
  const clearGallery = () => {
    if (!confirm("Clear gallery? This will remove all saved images locally.")) return;
    setGallery([]);
  };

  return (
    <div className="min-h-screen text-white bg-transparent">
      {/* NAVBAR */}
      <nav className="w-full flex justify-between items-center px-8 py-4 
        bg-black/10 backdrop-blur-md text-white text-sm border-b border-white/10 
        fixed top-0 left-0 z-50">
        <div className="flex gap-6 items-center">
          <button
            onClick={() => setView("home")}
            className={`px-2 py-1 rounded-md transition ${
              view === "home" ? "text-white font-semibold" : "text-white/60 hover:text-white"
            }`}
          >
            Home
          </button>
          <button
            onClick={() => setView("gallery")}
            className={`px-2 py-1 rounded-md transition ${
              view === "gallery" ? "text-white font-semibold" : "text-white/60 hover:text-white"
            }`}
          >
            Gallery
          </button>
        </div>

<div className="text-right text-gray-400 text-xs">
  Made by{" "}
  <a
    href="https://x.com/charve_web3"
    target="_blank"
    rel="noopener noreferrer"
    className="text-white font-semibold hover:underline"
  >
    Charve
  </a>{" "}
  for <span className="text-blue-400">Re community</span>
</div>
      </nav>

      {/* MAIN AREA */}
      <div className="max-w-7xl mx-auto p-6 pt-20">
        {view === "home" ? (
          // === GENERATOR UI (оригинальный интерфейс) ===
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT: Canvas */}
            <div className="flex-shrink-0 w-full lg:w-auto">
              <div className="canvas-wrapper shadow-lg rounded-2xl p-4 bg-[#0f0f1f]">
                <div
                  id="rexyz-canvas"
                  ref={canvasRef}
                  className="relative w-[512px] h-[512px] rounded-2xl overflow-hidden bg-[#0a0b1a] mx-auto"
                >
                  {combinedRenderList().map((entry) => {
                    if (entry.type === "base") {
                      const item = entry.item;
                      const l = entry.l;
                      const isBg = item.id === "bg";
                      if (isBg) {
                        return (
                          <img
                            key={`${resetKey}-${item.id}`}
                            src={item.variants[l.variant]}
                            alt={item.label}
                            className="absolute inset-0 w-full h-full object-cover"
                            draggable={false}
                          />
                        );
                      }
                      return (
                        <motion.div
                          key={`${resetKey}-${item.id}`}
                          className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
                          drag
                          dragMomentum={false}
                          dragConstraints={{
                            left: -256,
                            right: 256,
                            top: -256,
                            bottom: 256,
                          }}
                          style={{
                            x: l.x,
                            y: l.y,
                            zIndex: l.z,
                          }}
                        >
                          <div
                            style={{
                              transform: `scale(${l.scale}) rotate(${l.rotate}deg)`,
                              transformOrigin: "center",
                            }}
                          >
                            <img
                              src={item.variants[l.variant]}
                              alt={item.label}
                              draggable={false}
                            />
                          </div>
                        </motion.div>
                      );
                    } else {
                      const a = entry.attr;
                      const src = getVariantsFor(a.sourceId)[a.variant];
                      return (
                        <motion.div
                          key={`${resetKey}-${a.id}`}
                          className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
                          drag
                          dragMomentum={false}
                          dragConstraints={{
                            left: -256,
                            right: 256,
                            top: -256,
                            bottom: 256,
                          }}
                          style={{
                            x: a.x,
                            y: a.y,
                            zIndex: a.z,
                          }}
                        >
                          <div
                            style={{
                              transform: `scale(${a.scale}) rotate(${a.rotate}deg)`,
                              transformOrigin: "center",
                            }}
                          >
                            <img src={src} alt={a.sourceId} draggable={false} />
                          </div>
                        </motion.div>
                      );
                    }
                  })}
                </div>

                {/* Buttons */}
                <div className="mt-4 flex gap-3 justify-center flex-wrap">
                  <button onClick={saveToGallery} className="btn-purple inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95">
                    <Save size={16} /> Save to Gallery
                  </button>
                  <button onClick={downloadPng} className="btn-purple inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/10">
                    <Download size={16} /> Download PNG
                  </button>
                  <button onClick={handleResetAll} className="btn-purple inline-flex items-center gap-2 px-4 py-2 rounded-md border border-white/10">
                    <RotateCcw size={16} /> Reset All
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: Controls */}
            <div className="flex-1 generator-card min-w-[320px] custom-scroll rounded-xl p-4 bg-transparent">
              <div className="flex gap-3 mb-6 flex-wrap">
                {Object.keys(GROUPS).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setSelectedCategory(null);
                      setSelectedIndex(0);
                    }}
                    className={`px-3 py-1 rounded-md transition ${
                      tab === t ? "bg-white/8 text-white font-semibold" : "text-white/60 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === "Attributes" ? (
                <div>
                  {!selectedCategory ? (
                    <div className="grid grid-cols-2 gap-3">
                      {GROUPS.Attributes.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedIndex(0);
                          }}
                          className="variant-preview border border-[#2e2e3a] rounded-xl p-3 flex flex-col items-start gap-2 bg-[#0b0b12]"
                        >
                          <div className="text-sm font-semibold text-white">
                            {cat.label}
                          </div>
                          <div className="text-xs text-white/60 mt-1">
                            {cat.variants.length} items
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="generator-card-inner border border-[#2e2e3a] rounded-xl p-4 bg-[#080811]">
                      <div className="grid grid-cols-3 items-center mb-3">
                        <button
                          className="btn-purple justify-self-start px-3 py-1 rounded-md"
                          onClick={() => setSelectedCategory(null)}
                        >
                          ← Back
                        </button>
                        <div className="text-center text-white/70">
                          {
                            GROUPS.Attributes.find((g) => g.id === selectedCategory)
                              ?.label
                          }{" "}
                          {selectedIndex + 1} /{" "}
                          {
                            GROUPS.Attributes.find((g) => g.id === selectedCategory)
                              ?.variants.length
                          }
                        </div>
                        <div />
                      </div>

                      <div className="flex items-center justify-center gap-6 mb-3">
                        <button
                          className="button-round px-3 py-2 rounded-full border border-white/10"
                          onClick={() => {
                            const len = GROUPS.Attributes.find(
                              (g) => g.id === selectedCategory
                            ).variants.length;
                            setSelectedIndex((p) => (p - 1 + len) % len);
                          }}
                        >
                          <ChevronLeft />
                        </button>

                        <div className="w-40 h-40 flex items-center justify-center bg-[#0a0b1a] rounded">
                          <img
                            src={
                              GROUPS.Attributes.find((g) => g.id === selectedCategory)
                                .variants[selectedIndex]
                            }
                            alt="preview"
                            className="max-w-full max-h-full object-contain"
                            draggable={false}
                          />
                        </div>

                        <button
                          className="button-round px-3 py-2 rounded-full border border-white/10"
                          onClick={() => {
                            const len = GROUPS.Attributes.find(
                              (g) => g.id === selectedCategory
                            ).variants.length;
                            setSelectedIndex((p) => (p + 1) % len);
                          }}
                        >
                          <ChevronRight />
                        </button>
                      </div>

                      <div className="flex justify-center">
                        <button className="btn-purple inline-flex items-center gap-2 px-4 py-2 rounded-md" onClick={() => addAttribute()}>
                          <PlusCircle size={16} /> Add
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAttrs.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {activeAttrs.map((a) => {
                        const variants = getVariantsFor(a.sourceId);
                        const src = variants[a.variant];
                        return (
                          <div
                            key={a.id}
                            className="generator-card-inner border border-[#2e2e3a] rounded-xl p-4 bg-[#080811]"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-bold text-white uppercase">
                                {a.sourceId}
                              </h3>
                              <button
                                className="button-round p-2 rounded-md border border-white/10"
                                onClick={() => removeAttr(a.id)}
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="flex items-center justify-center mb-3">
                              <img
                                src={src}
                                alt={a.sourceId}
                                className="max-w-[80px] max-h-[80px]"
                              />
                            </div>

                            <div className="control-panel">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <button
                                  className="button-round p-2 rounded-md border border-white/10"
                                  onClick={() =>
                                    updateAttr(a.id, { z: Math.max(1, a.z - 1) })
                                  }
                                >
                                  -
                                </button>
                                <span className="text-white/80">Layer: {a.z}</span>
                                <button
                                  className="button-round p-2 rounded-md border border-white/10"
                                  onClick={() => updateAttr(a.id, { z: a.z + 1 })}
                                >
                                  +
                                </button>
                              </div>

                              <div className="mb-2">
                                <label className="text-xs text-white/60 block mb-1">
                                  Scale ({Math.round(a.scale * 100)}%)
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="150"
                                  value={Math.round(a.scale * 100)}
                                  onChange={(e) =>
                                    updateAttr(a.id, {
                                      scale: parseInt(e.target.value, 10) / 100,
                                    })
                                  }
                                  className="w-full"
                                />
                              </div>

                              <div className="mb-2">
                                <label className="text-xs text-white/60 block mb-1">
                                  Rotate ({a.rotate}°)
                                </label>
                                <input
                                  type="range"
                                  min="-180"
                                  max="180"
                                  value={a.rotate}
                                  onChange={(e) =>
                                    updateAttr(a.id, {
                                      rotate: parseInt(e.target.value, 10),
                                    })
                                  }
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                // Body / Background tabs
                <div className="grid grid-cols-2 gap-4">
                  {GROUPS[tab].map((item) => {
                    const l = layers[item.id];
                    if (!l) return null;
                    const isBg = item.id === "bg";

                    return (
                      <div
                        key={item.id}
                        className="generator-card-inner border border-[#2e2e3a] rounded-xl p-4 bg-[#080811]"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-white uppercase">
                            {item.label}
                          </h3>
                          <input
                            type="checkbox"
                            checked={l.visible}
                            onChange={(e) =>
                              updateLayer(item.id, { visible: e.target.checked })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {item.variants.map((src, i) => (
                            <button
                              key={i}
                              className={`variant-preview rounded-md overflow-hidden border ${l.variant === i ? "border-blue-400" : "border-transparent"} bg-[#0a0b12] p-1`}
                              onClick={() => updateLayer(item.id, { variant: i })}
                            >
                              <img src={src} alt="" draggable={false} className="max-w-full max-h-full object-contain"/>
                            </button>
                          ))}
                        </div>

                        {!isBg && (
                          <div className="control-panel">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <button
                                className="button-round p-2 rounded-md border border-white/10"
                                onClick={() =>
                                  updateLayer(item.id, { z: Math.max(1, l.z - 1) })
                                }
                              >
                                -
                              </button>
                              <span className="text-white/80">Layer: {l.z}</span>
                              <button
                                className="button-round p-2 rounded-md border border-white/10"
                                onClick={() => updateLayer(item.id, { z: l.z + 1 })}
                              >
                                +
                              </button>
                            </div>

                            <div className="mb-2">
                              <label className="text-xs text-white/60 block mb-1">
                                Scale ({Math.round(l.scale * 100)}%)
                              </label>
                              <input
                                type="range"
                                min="10"
                                max="150"
                                value={Math.round(l.scale * 100)}
                                onChange={(e) =>
                                  updateLayer(item.id, {
                                    scale: parseInt(e.target.value, 10) / 100,
                                  })
                                }
                                className="w-full"
                              />
                            </div>

                            <div className="mb-2">
                              <label className="text-xs text-white/60 block mb-1">
                                Rotate ({l.rotate}°)
                              </label>
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                value={l.rotate}
                                onChange={(e) =>
                                  updateLayer(item.id, {
                                    rotate: parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full"
                              />
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                className="btn-purple-sm inline-flex items-center gap-2 px-3 py-1 rounded-md border border-white/10"
                                onClick={() =>
                                  updateLayer(item.id, {
                                    x: 0,
                                    y: 0,
                                    scale: 1,
                                    rotate: 0,
                                  })
                                }
                              >
                                <RotateCcw size={14} /> Reset
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          // === GALLERY VIEW ===
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Gallery</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setView("home"); }}
                  className="px-3 py-1 rounded-md bg-white/6 hover:bg-white/8"
                >
                  Back to Editor
                </button>
                <button
                  onClick={clearGallery}
                  className="px-3 py-1 rounded-md border border-white/10 text-sm text-white/70"
                >
                  Clear Gallery
                </button>
              </div>
            </div>

            {gallery.length === 0 ? (
              <div className="text-center text-white/60 py-12 rounded-lg border border-white/5 bg-black/20 backdrop-blur-sm">
                No saved images yet. Click <span className="font-semibold">Save to Gallery</span> in the editor to store images here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gallery.map((dataUrl, idx) => (
                  <div key={idx} className="rounded-xl overflow-hidden border border-white/5 bg-black/20 backdrop-blur-sm p-2 flex flex-col">
                    <div className="w-full aspect-square rounded-md overflow-hidden mb-2 bg-black flex items-center justify-center">
                      <img src={dataUrl} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => downloadFromGallery(dataUrl, idx)}
                        className="px-3 py-1 rounded-md bg-white/6 hover:bg-white/8 text-sm inline-flex items-center gap-2"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => removeFromGallery(idx)}
                        className="px-3 py-1 rounded-md border border-red-500 text-red-400 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
