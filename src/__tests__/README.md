# Test — bản đồ

`npm test` chạy **mọi** file `*.test.js` dưới `src/` bằng runner sẵn có của Node
(`node --test`). **Không phải khai báo file mới ở đâu cả** — cứ đặt đúng thư mục là nó chạy.

Chạy một file khi đang sửa: `node src/__tests__/money/dues.test.js`
Chạy một nhánh: `node --test "src/__tests__/money/*.test.js"`

Không framework, không mock: mọi thứ ở đây là hàm **thuần** gọi bằng `node:assert/strict`.
Code chạm Supabase/React không có mặt trong bộ này — kiểm tay trên DB thật (`RULES.md` §5).

---

## Tìm test ở đâu

| Muốn kiểm | Vào file |
| --- | --- |
| Làm tròn tiền · đọc ô nhập có dấu chấm · thang trình độ · tên người trả | `money/format.test.js` |
| Tiền sân một buổi · sân bán · sân thuê thêm | `money/court.test.js` |
| Định mức cầu · giá bình quân kho · tồn kho · kiểm kho cuối tháng | `money/shuttle.test.js` |
| Bảng giá khách · công nợ khách · gộp theo người rủ | `money/guest.test.js` |
| Điểm danh · danh sách cố định theo tháng · vào giữa tháng · ngưng / xoá thành viên | `money/member.test.js` |
| **Quỹ tháng → đơn giá một buổi → đối chiếu buổi** (một chuỗi, để chung) | `money/dues.test.js` |
| Giá thành buổi · đóng băng khi chốt · cảnh báo trước và sau khi chốt | `money/cost.test.js` |
| Cảnh báo sai im lặng ở Trang chủ | `money/alerts.test.js` |
| Xoá nhóm: chặn tạm (có buổi tương lai) vs chặn vĩnh viễn (dính lịch sử tiền) | `money/group_delete.test.js` |
| Xoá buổi: điều kiện an toàn, dọn buổi chưa phát sinh chi phí | `money/session_delete.test.js` |
| **Thành viên tự khai đã chuyển tiền** — khoản nào khai được, chiều tiền, chủ sở hữu | `money/claims.test.js` |
| Sổ quỹ: dòng nào vào sổ, số dư, số dư khả dụng, gộp dòng, tổng hợp ngày | `ledger/ledger.test.js` |
| Hoàn tác / sửa một dòng sổ quỹ: dòng nào gỡ được, gỡ ở nguồn nào | `ledger/undo.test.js` |
| Chia sân: slot · 5 chế độ xếp · chia đều · đếm số trận | `lib/assign.test.js` |
| Ngày tháng, lưới lịch, sinh ngày theo thứ | `lib/dates.test.js` |
| **Ma trận quyền 3 vai** — cờ, route, "xem như", và khớp với seed trong DB | `lib/roles.test.js` |
| Giá trị mặc định của mọi dialog | `lib/forms.test.js` |
| Lọc · tìm (bỏ dấu) · sắp xếp danh sách thành viên · trạng thái thu quỹ tháng | `lib/members.test.js` |
| Sửa lịch cố định: buổi nào được đụng, sinh/xoá buổi, tháng bị đổi đơn giá | `lib/schedules.test.js` |
| Đọc / sinh CSV thành viên, RFC 4180, phát hiện cột, validate & cảnh báo trùng | `lib/csv.test.js` |
| Sao lưu & khôi phục cài đặt CLB dạng file JSON | `lib/settings_export.test.js` |
| Map client ↔ Postgres, thứ tự ghi/xoá, `diff()` | `sync/dbmap.test.js` |
| Lỗi đồng bộ nào thử lại được, lỗi nào phải nạp lại DB | `sync/fatal.test.js` |
| CLB vừa tạo (mọi bảng rỗng) không được throw / NaN / Infinity | `smoke/empty.test.js` |
| Không sót key i18n, không còn chữ cứng trong code, không có số lọt vào `vi.json` | `smoke/i18n.test.js` |
| Sinh link VietQR, parse thông tin ngân hàng từ QR | `lib/vietqr.test.js` |
| Khách giao lưu đi cùng: logic đồng hành, gom nhóm | `money/companion_guest.test.js` |

`fixture.js` — bộ dữ liệu cố định (2 CLB, tháng 08/2026) mọi file dùng chung. App **không**
import nó; dữ liệu thật nằm ở Supabase.

---

## Đặt test mới vào đâu

- Hàm thuần trong `src/lib/<x>.js` hoặc `src/utils/` → `lib/<x>.test.js`.
- Thêm vào `src/lib/money.js` → chọn file `money/*` theo **chủ đề tiền**, không theo tên hàm.
  `money.js` quá lớn để một file test, nên nó tách theo việc chứ không theo file nguồn.
- Đụng cách ghi xuống Postgres → `sync/`.
- Bất biến quét toàn repo (i18n, CLB rỗng) → `smoke/`.

## Ba luật khi viết

1. **Test fail thì DỪNG** và báo user trước khi sửa test hay sửa logic — không tự chọn cái nào
   dễ sửa hơn (`RULES.md` §5).
2. **Mỗi assert nói rõ vì sao sai là tốn tiền**, không chỉ nói "sai". Thông điệp assert là chỗ
   người sau đọc để hiểu luật nghiệp vụ, không phải chú thích thừa.
3. **Mutation-test cái vừa viết**: tắt nhánh logic tương ứng, chạy lại, phải ĐỎ. Test không bắt
   được lỗi nào thì chỉ là dòng chữ trang trí.
