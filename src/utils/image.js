// Tiện ích nén ảnh, xử lý kích thước và chuyển đổi ảnh sang Base64 Data URL.
// Chạy hoàn toàn trên trình duyệt, không cần thư viện ngoài.

/**
 * Đọc file ảnh và nén/resize về kích thước chuẩn.
 * @param {File} file File ảnh từ input[type="file"]
 * @param {object} options
 * @param {number} options.maxWidth Kích thước chiều rộng tối đa (default: 600)
 * @param {number} options.maxHeight Kích thước chiều cao tối đa (default: 600)
 * @param {number} options.quality Chất lượng nén 0.1 - 1.0 (default: 0.85)
 * @returns {Promise<string>} Chuỗi Base64 Data URL
 */
export function compressImage(file, { maxWidth = 600, maxHeight = 600, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('File không phải là định dạng hình ảnh hợp lệ.'))
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh.'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh.'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Tính toán tỷ lệ co giãn giữ nguyên aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Xuất ra dạng webp nếu trình duyệt hỗ trợ, hoặc jpeg
        try {
          const dataUrl = canvas.toDataURL('image/webp', quality)
          if (dataUrl.startsWith('data:image/webp')) {
            return resolve(dataUrl)
          }
        } catch {
          // Bỏ qua nếu không hỗ trợ webp
        }
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
