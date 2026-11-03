# 🧊 Morphia 3D — Hướng dẫn dự án

> Morphia 3D là một ứng dụng React + Vite dựng nên giao diện thương mại cho dịch vụ tạo mô hình 3D, hiển thị sản phẩm, trải nghiệm 3D và các trang marketing liên quan.

## 📋 Mục lục

- [Yêu cầu hệ thống](#-yêu-cầu-hệ-thống)
- [Cài đặt và chạy](#-cài-đặt-và-chạy)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Vai trò các file chính](#-vai-trò-các-file-chính)
- [Routes hiện có](#-routes-hiện-có)
- [Thư viện sử dụng](#-thư-viện-sử-dụng)
- [Ghi chú phát triển](#-ghi-chú-phát-triển)

---

## 💻 Yêu cầu hệ thống

| Phần mềm | Phiên bản đề xuất |
| --- | --- |
| Node.js | 18.x trở lên |
| npm | 9.x trở lên |

---

## 🚀 Cài đặt và chạy

### 1. Vào thư mục dự án

```bash
cd đường dẫn thư mục
```

### 2. Cài đặt dependencies

```bash
npm install
```

### 3. Chạy môi trường phát triển

```bash
npm run dev
```

Sau khi chạy, ứng dụng sẽ mở tại:

```text
http://localhost:3000
```

### 4. Build production (tùy chọn)

```bash
npm run build
```

### 5. Xem trước bản build

```bash
npm run preview
```

---

## 📁 Cấu trúc thư mục

```text
tên folder/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── public/
│   ├── images/
│   └── models/
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── FloatingShapes.jsx
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── ThreeDViewer.jsx
│   │   └── home/
│   ├── layouts/
│   │   └── MainLayout.jsx
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── MarketplacePage.jsx
│   │   ├── ProductsPage.jsx
│   │   ├── ProductDetailPage.jsx
│   │   ├── AIStudioPage.jsx
│   │   ├── WorkflowPage.jsx
│   │   ├── PricingPage.jsx
│   │   └── ResourcesPage.jsx
│   ├── routes/
│   │   └── AppRoutes.jsx
│   └── data/
│       ├── mockData.js
│       ├── products.js
│       └── keychainProducts.js
```

---

## 🧩 Vai trò các file chính

| File | Nhiệm vụ |
| --- | --- |
| `index.html` | File HTML gốc, chèn ứng dụng React vào `#root`. |
| `src/main.jsx` | Điểm khởi động React, render `<App />` vào DOM. |
| `src/App.jsx` | File cấp cao nhất, chứa nền chuyển động và khởi tạo router. |
| `src/routes/AppRoutes.jsx` | Định nghĩa các route của website. |
| `src/layouts/MainLayout.jsx` | Layout chung cho toàn bộ trang: navbar, footer và outlet. |
| `src/pages/` | Chứa các trang riêng biệt: trang chủ, marketplace, pricing, resources... |
| `src/components/FloatingShapes.jsx` | Tạo hiệu ứng nền 3D nổi trên toàn màn hình. |
| `src/components/Navbar.jsx` | Thanh điều hướng chính, menu và nút CTA. |
| `src/components/Footer.jsx` | Chân trang chung cho toàn bộ website. |
| `src/components/ThreeDViewer.jsx` | Component xem mô hình 3D bằng Three.js, hỗ trợ STL và fallback. |
| `src/components/home/` | Các section homepage: Hero, Features, CuratedModels, Pricing, CTA. |
| `src/data/` | Dữ liệu mẫu cho sản phẩm và marketplace. |
| `public/models/` | File mô hình 3D dùng để demo, ví dụ `.stl`. |
| `public/images/` | Ảnh tĩnh dùng cho giao diện và sản phẩm. |

---

## 🗺️ Routes hiện có

| Route | Mục đích |
| --- | --- |
| `/` | Trang chủ |
| `/marketplace` | Trang marketplace sản phẩm |
| `/studio` | Trang AI Studio |
| `/products` | Danh sách sản phẩm |
| `/product/:id` | Chi tiết một sản phẩm |
| `/workflow` | Trang giải thích quy trình làm việc |
| `/pricing` | Trang bảng giá |
| `/resources` | Trang tài nguyên và hỗ trợ |

---

## 📦 Thư viện sử dụng

| Thư viện | Vai trò |
| --- | --- |
| `react` | Framework UI chính |
| `react-dom` | Render React vào DOM |
| `react-router-dom` | Điều hướng giữa các trang |
| `vite` | Build tool và dev server |
| `tailwindcss` | Styling utility-first |
| `framer-motion` | Animation mượt mà |
| `three` | Engine render 3D |
| `@react-three/fiber` | Tích hợp Three.js với React |
| `@react-three/drei` | Helper cho scene 3D, controls, shadows |
| `react-icons` | Icon cho navbar, buttons và section |

---

## 🛠️ Ghi chú phát triển

- Nếu thêm một trang mới, hãy tạo file trong `src/pages/` rồi đăng ký route trong `src/routes/AppRoutes.jsx`.
- Nếu thêm một component dùng chung, đặt trong `src/components/`.
- Nếu cần thêm dữ liệu sản phẩm, chỉnh trong `src/data/`.
- Nếu muốn đổi giao diện hoặc màu sắc, chỉnh trong `tailwind.config.js` và `src/index.css`.
- File mô hình 3D demo hiện đang nằm trong `public/models/`.

---

## ✅ Mẹo làm việc với dự án

1. Chạy `npm run dev` khi bắt đầu sửa giao diện.
2. Chỉ sửa component phù hợp với mục đích của nó: layout, page, hay shared UI.
3. Khi thêm section mới cho homepage, nên đặt trong `src/components/home/` để giữ cấu trúc rõ ràng.
