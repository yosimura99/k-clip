# K.Clip

Trang tải clip không logo, dùng kèm phím tắt Share trên iPhone.

- Trang: https://yosimura99.github.io/k-clip/
- Nhận link qua `?url=` hoặc `#url=` (phím tắt iOS gửi vào đây).
- TikTok: bản không watermark. Telegram: chỉ kênh/bài công khai.
- Không lưu mật khẩu. Không vượt hạn chế tải của nhóm Telegram.

## Phím tắt cài 1 chạm

- Mở trang trên Safari iPhone → bấm **Cài phím tắt K.Clip** (`shortcuts://import-shortcut?url=…/K.Clip.shortcut&name=K.Clip`).
- File: https://yosimura99.github.io/k-clip/K.Clip.shortcut (đã ký AEA1 qua HubSign của RoutineHub, vì iOS 15+ chỉ nhận phím tắt đã ký).
- Tạo lại: `python3 tools/build_shortcut.py` (nguồn XML: `K.Clip.unsigned.plist`).
- Phím tắt: nhận URL/Văn bản từ trang Chia sẻ → Mã hóa URL → mở `https://yosimura99.github.io/k-clip/?url=…`.
