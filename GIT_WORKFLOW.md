# 🌿 Git Commit & Push Workflow Standard (Quy trình Commit & Push Mã Nguồn Chuẩn)

Tài liệu này quy định quy trình làm việc với Git, quy chuẩn đặt tên Commit (Conventional Commits), chiến lược phân nhánh (Branching Strategy) và các bước kiểm thử trước khi push mã nguồn cho dự án **convert-md-to-pdf**.

---

## 📌 1. Chiến lược Phân nhánh (Branching Strategy)

Dự án áp dụng mô hình phân nhánh chuẩn **Git Flow**:

| Tên Nhánh | Mô Tả & Quy Tắc |
| :--- | :--- |
| **`main`** | **Production Branch**: Chỉ chứa mã nguồn ổn định nhất, đã được kiểm thử 100%. Mọi phiên bản phát hành (Release) được tag từ đây. |
| **`develop`** | **Development Branch**: Nhánh tích hợp chính cho các tính năng mới trước khi merge vào `main`. |
| **`feature/<name>`** | **Feature Branches**: Nhánh phát triển tính năng mới. *(Ví dụ: `feature/auto-toc`, `feature/dark-theme`)* |
| **`fix/<name>`** | **Bugfix Branches**: Nhánh sửa lỗi phát sinh. *(Ví dụ: `fix/math-parsing`, `fix/icon-dimensions`)* |
| **`release/vX.Y.Z`** | **Release Branches**: Nhánh chuẩn bị đóng gói phiên bản mới. |

---

## 📝 2. Quy chuẩn Đặt tên Commit (Conventional Commits)

Mọi commit bắt buộc tuân theo định dạng chuẩn quốc tế **Conventional Commits**:

$$\text{Format: } \mathbf{<type>(<scope>): <description>}$$

### Các `<type>` được phép sử dụng:

- **`feat`**: Bổ sung tính năng mới cho người dùng.
- **`fix`**: Sửa lỗi (Bug fix).
- **`docs`**: Cập nhật tài liệu (README, PRIVACY_POLICY, STORE_LISTING...).
- **`style`**: Thay đổi giao diện, CSS, icon, format code không làm ảnh hưởng logic.
- **`refactor`**: Tái cấu trúc code (không thêm tính năng mới, không sửa bug).
- **`perf`**: Cải thiện hiệu năng xử lý.
- **`test`**: Bổ sung hoặc sửa đổi bộ kiểm thử (Test cases).
- **`chore`**: Cập nhật phụ thuộc (dependencies), file `.gitignore`, cấu hình build script.

### Ví dụ các Commit chuẩn:
```text
feat(extension): add Auto TOC checkbox and smooth anchor link scroll
fix(cli): resolve wildcard pattern resolution on Windows paths
docs(store): update Chrome Web Store submission guide and screenshots
style(icons): update extension logo with 3D glassmorphism artwork
refactor(core): modularize parser and renderer into core module
chore(deps): bump marked library to version 12.0.2
```

---

## 🔄 3. Quy trình 5 Bước Commit & Push Chuẩn

### Bước 1: Đồng bộ mã nguồn mới nhất từ Server
Trước khi bắt đầu làm việc hoặc trước khi push, luôn pull code mới nhất về:
```bash
git checkout main
git pull origin main
```

### Bước 2: Tạo nhánh làm việc mới
```bash
git checkout -b feature/ten-tinh-nang-moi
```

### Bước 3: Kiểm thử tự động trước khi Commit (Pre-commit Checks)
Chạy bộ kiểm thử CLI và build đóng gói Extension để đảm bảo không gãy code:
```bash
# 1. Kiểm thử CLI conversion
npm test

# 2. Kiểm thử build Extension ZIP
npm run build:extension
```

### Bước 4: Stage & Commit mã nguồn
```bash
# Kiểm tra các file đã thay đổi
git status

# Stage các file cần commit (hoặc chọn lọc: git add src/...)
git add .

# Commit theo chuẩn Conventional Commits
git commit -m "feat(scope): mô tả ngắn gọn tính năng"
```

### Bước 5: Push lên Remote Repository & Tạo Pull Request
```bash
# Push nhánh feature lên GitHub
git push -u origin feature/ten-tinh-nang-moi
```
Sau đó truy cập GitHub repository để mở **Pull Request (PR)** merge vào nhánh `main`.

---

## 🏷️ 4. Quy trình Đóng gói & Release Phiên bản mới

Hệ thống hỗ trợ 2 phương án phát hành Release hoàn toàn tự động:

### Cách 1: Tự động Release khi Merge `develop` vào `main` (Khuyên dùng)
1. Khi hoàn tất phát triển tính năng trên `develop`, mở Pull Request hoặc merge `develop` vào `main`.
2. Push lên `main`: `git push origin main`
3. GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) sẽ tự động đọc số version từ `package.json`, chạy test, build file ZIP và tự đăng bài Release lên GitHub đính kèm file nén `extension-vX.Y.Z.zip`!

### Cách 2: Chạy lệnh Release 1-Click từ CLI
```bash
# Nâng version tự động (patch | minor | major hoặc nhập số version cụ thể)
npm run release 1.2.0
```
*Script sẽ tự động kiểm tra test, cập nhật version, tạo tag, và push lên GitHub để kích hoạt release tự động.*
