# 🛒 Chrome Web Store Listing Kit & Submission Information

Tài liệu này chứa toàn bộ thông tin, nội dung mô tả, hình ảnh và giải trình quyền (Permissions justification) cần thiết để đăng tải extension **Markdown to PDF Converter** lên **Chrome Web Store Developer Dashboard**.

---

## 📌 1. Basic Extension Metadata (Thông tin Cơ bản)

| Field / Mục | Value / Giá trị Tiếng Anh | Giá trị Tiếng Việt |
| :--- | :--- | :--- |
| **Extension Name** | `Markdown to PDF Converter - Mermaid & Math` | `Markdown sang PDF Converter - Mermaid & KaTeX` |
| **Short Description** *(Max 132 chars)* | `Convert Markdown files, text, or web pages into beautifully styled PDFs with Mermaid diagrams, LaTeX math, and custom themes.` | `Chuyển đổi file Markdown, văn bản hoặc trang web sang file PDF đẹp mắt hỗ trợ sơ đồ Mermaid, công thức KaTeX và giao diện tùy chỉnh.` |
| **Category** | `Developer Tools` (hoặc `Productivity`) | `Công cụ dành cho nhà phát triển` |
| **Language** | `English` (Primary) | `Vietnamese` (Secondary Translation) |
| **Price** | Free | Miễn phí |

---

## 📝 2. Detailed Description (Mô tả Chi tiết trên Store)

### 🇬🇧 English Description (Chrome Web Store Primary):
```text
Convert Markdown files, raw text, and web documentation into high-quality, beautifully formatted PDF documents directly inside your browser!

Markdown to PDF Converter is a lightweight, privacy-focused extension that transforms your Markdown code, technical documentation, SRS reports, and notes into publication-ready PDFs with 1-click.

🌟 KEY FEATURES:
• 📑 Auto Cover Page Generator: Auto-build document report cover pages with title, subtitle, author, and date.
• 📌 Dotted Leader Line TOC: Publication-grade Table of Contents with dotted leader lines (...) and clickable anchor links.
• 📊 Native Mermaid.js Diagrams: Full support for sequence diagrams (with text wrapping), flowcharts, class diagrams, and gantt charts.
• 📐 LaTeX Math Equations: Beautiful inline and display math formula rendering powered by KaTeX ($E = mc^2$).
• 🎨 7 Preset Themes: Choose between Modern, Dark Mode, Academic, GitHub, E-Book, Cyberpunk, and Minimal.
• 🔤 Open-Source Font Selector: Select your preferred typography (Inter, Roboto, Lora, Merriweather, JetBrains Mono, Fira Code).
• 📁 Multiple Input Methods: Drag & drop single or batch .md files, paste raw text, or convert active tab content automatically.
• 🖱️ Right-Click Context Menu: Highlight any Markdown text on any website and right-click to convert to PDF immediately.
• 🌐 GitHub Raw MD Integration: Displays an automatic floating "Convert to PDF" button on GitHub raw file pages.
• 🔒 100% Private & Offline: Runs entirely inside your browser. No registration, no cloud servers, and no data tracking.

🚀 HOW TO USE:
1. Click the extension icon in your toolbar.
2. Drag & drop .md file(s) or paste your Markdown content.
3. Select your desired theme (Modern, Dark, GitHub, Cyberpunk...) and font (Inter, Roboto, Lora...).
4. Click "Preview & Export PDF" to view and print your vector PDF or download static HTML!

Perfect for developers, technical writers, students, engineers, and researchers!
```

### 🇻🇳 Vietnamese Description (Mô tả Tiếng Việt):
```text
Chuyển đổi file Markdown, văn bản thô và tài liệu web sang file PDF chất lượng cao, giao diện chuyên nghiệp ngay trên trình duyệt của bạn!

Markdown to PDF Converter là tiện ích mở rộng nhẹ, an toàn bảo mật, giúp biến các file Markdown, tài liệu kỹ thuật SRS, báo cáo và ghi chú của bạn thành file PDF chuẩn in ấn chỉ với 1 cú nhấp chuột.

🌟 TÍNH NĂNG NỔI BẬT:
• 📑 Trang bìa báo cáo tự động: Tự tạo trang bìa sang trọng hiển thị Tên tài liệu, Tác giả, Ngày lập và Subtitle.
• 📌 Mục lục đường chấm (Dotted TOC): Tạo mục lục chuẩn xuất bản với đường chấm nối số trang và liên kết anchor link.
• 📊 Sơ đồ Mermaid.js: Hỗ trợ đầy đủ sơ đồ trình tự (sequence diagram), lưu đồ (flowchart), class diagram, gantt chart...
• 📐 Công thức toán LaTeX: Hiển thị công thức toán học nội dòng và khối công thức sắc nét nhờ KaTeX.
• 🎨 7 Giao diện (Themes): Modern, Dark Mode, Academic, GitHub, E-Book, Cyberpunk và Minimal.
• 🔤 Bộ chọn Font chữ mở rộng: Tùy chọn font chữ chuyên nghiệp (Inter, Roboto, Lora, Merriweather, JetBrains Mono, Fira Code).
• 📁 Đa dạng phương thức nhập: Kéo thả một hoặc nhiều file .md, dán văn bản thô hoặc tự động lấy nội dung trang web đang mở.
• 🖱️ Menu chuột phải (Context Menu): Bôi đen văn bản Markdown trên trang web bất kỳ -> Chuột phải để chuyển sang PDF ngay lập tức.
• 🌐 Tích hợp GitHub Raw File: Hỗ trợ nút bấm nổi "Convert to PDF" tiện lợi khi mở file .md raw trên GitHub.
• 🔒 Bảo mật 100% Offline: Xử lý hoàn toàn cục bộ trên trình duyệt, không tải dữ liệu lên máy chủ bên ngoài.

🚀 HƯỚNG DẪN SỬ DỤNG:
1. Nhấn vào biểu tượng tiện ích trên thanh công cụ Chrome.
2. Kéo thả file .md hoặc dán đoạn mã Markdown.
3. Chọn Theme mong muốn (Modern, Dark, GitHub, Cyberpunk...) và font chữ.
4. Nhấn "Preview & Export PDF" để xem trước và lưu file PDF hoặc tải file HTML!
```

---

## 🔒 3. Single Purpose & Privacy Justification Statements

Khi nộp extension lên Chrome Web Store Developer Dashboard, Chrome sẽ yêu cầu bạn nhập **Single Purpose Statement** và giải trình các quyền (**Permissions Justifications**):

### Single Purpose Statement:
> `"The single purpose of this extension is to parse Markdown text/files and convert them into visually styled, printable PDF documents locally within the user's browser."`

### Permission Justifications (Giải trình Quyền):

1. **`activeTab`**:
   > `"Required to extract raw Markdown text from the current active browser tab when the user explicitly clicks the 'Grab Active Tab Content' button or uses the context menu."`

2. **`storage`**:
   > `"Required to store user preference settings locally (such as selected theme, paper size, and diagram toggles) as well as temporary document payload for rendering."`

3. **`contextMenus`**:
   > `"Required to add context menu items ('Convert selected text to PDF' and 'Convert Markdown page to PDF') when the user right-clicks on text or pages."`

4. **`scripting`**:
   > `"Required to execute a lightweight script that extracts text content from raw .md files or GitHub raw pages for conversion."`

---

## 🖼️ 4. Store Visual Assets Checklist (Hình ảnh trên Store)

Toàn bộ hình ảnh đã được tự động tạo và lưu trữ trong thư mục **`store-assets/`**:

1. **Store Icon (128x128 px)**:
   - File: `store-assets/store_icon_128x128.jpg`
   - Mô tả: Icon thiết kế dạng huy hiệu góc bo viền chuyển đổi từ nút `#` Markdown sang biểu tượng PDF đỏ sang trọng.

2. **Promo Tile / Banner (440x280 px)**:
   - File: `store-assets/promo_tile_440x280.jpg`
   - Mô tả: Banner quảng bá hiển thị trên Store Card của Chrome Web Store với tiêu đề và các huy hiệu tính năng Mermaid, KaTeX, Themes.

3. **Store Screenshots (Tối thiểu 1280x800 px)**:
   - Screenshot 1 (Popup UI): `store-assets/screenshot_1_popup.jpg` (Hiển thị popup tiện ích kéo thả file và các lựa chọn theme).
   - Screenshot 2 (Preview Engine): `store-assets/screenshot_2_preview.jpg` (Hiển thị trang xem trước PDF sắc nét với sơ đồ trình tự và công thức toán).

---

## 🚀 5. Hướng dẫn các bước đăng tải lên Chrome Web Store

1. **Chuẩn bị file ZIP Extension**:
   Nén toàn bộ thư mục **`chrome-extension/`** thành file **`extension.zip`**:
   ```bash
   # Nén thư mục chrome-extension thành zip
   powershell -Command "Compress-Archive -Path chrome-extension\* -DestinationPath extension.zip -Force"
   ```

2. **Đăng nhập Chrome Developer Dashboard**:
   - Truy cập: [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
   - Đăng nhập tài khoản Google Developer (Phí đăng ký tài khoản nhà phát triển 1 lần là $5).

3. **Tải mục mới (Add new item)**:
   - Nhấn **"Add new item"** (Thêm mục mới) -> Tải file `extension.zip` lên.

4. **Điền thông tin & Hình ảnh**:
   - Sao chép nội dung ở **Mục 1 & 2** vào trang *Store listing*.
   - Upload `store_icon_128x128.jpg` vào mục *Extension icon*.
   - Upload `promo_tile_440x280.jpg` vào mục *Small promo tile (440x280)*.
   - Upload `screenshot_1_popup.jpg` và `screenshot_2_preview.jpg` vào mục *Screenshots*.

5. **Khai báo Quyền & Quyền riêng tư (Privacy practices)**:
   - Điền thông tin ở **Mục 3** vào phần *Single Purpose* và *Permissions justification*.
   - Đánh dấu chọn *"No user data is collected or sold"* (Tiện ích không thu thập hay bán dữ liệu người dùng).

6. **Gửi duyệt (Submit for review)**:
   - Nhấn **"Submit for review"**. Thời gian duyệt thường từ 24 - 48 giờ.
