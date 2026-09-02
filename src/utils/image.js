// Tiện ích nén ảnh, xử lý kích thước và tải lên Supabase Storage CDN.
import { supabase } from '#supabase'

/**
 * Nén ảnh và trả về Blob.
 * @param {File} file File ảnh từ input
 * @param {object} options
 * @param {number} [options.maxWidth=600]
 * @param {number} [options.maxHeight=600]
 * @param {number} [options.quality=0.85]
 * @returns {Promise<Blob>}
 */
export function compressImageToBlob(file, { maxWidth = 600, maxHeight = 600, quality = 0.85 } = {}) {
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

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else resolve(file)
          },
          'image/webp',
          quality
        )
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Đọc file ảnh và nén/resize về dạng Base64 Data URL.
 * @param {File} file File ảnh từ input[type="file"]
 * @param {object} options
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

/**
 * Nén và tải ảnh lên Supabase Storage bucket 'club-assets'.
 * Tự động fallback về chuỗi Base64 Data URL nếu offline hoặc không có Supabase.
 *
 * @param {File} file
 * @param {object} [options]
 * @param {string} [options.folder='avatars'] Thư mục phân loại: 'avatars' | 'qrcodes'
 * @param {number} [options.maxWidth=400]
 * @param {number} [options.maxHeight=400]
 * @param {number} [options.quality=0.85]
 * @returns {Promise<string>} URL ảnh công khai hoặc chuỗi Data URL
 */
export async function uploadImage(file, { folder = 'avatars', maxWidth = 400, maxHeight = 400, quality = 0.85 } = {}) {
  try {
    const blob = await compressImageToBlob(file, { maxWidth, maxHeight, quality })

    if (supabase) {
      const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
      const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)
      const fileName = `${folder}/${Date.now()}_${randomId}.${ext}`

      const { data, error } = await supabase.storage.from('club-assets').upload(fileName, blob, {
        contentType: blob.type || 'image/webp',
        upsert: true,
      })

      if (!error && data?.path) {
        const { data: pub } = supabase.storage.from('club-assets').getPublicUrl(data.path)
        if (pub?.publicUrl) return pub.publicUrl
      }
    }
  } catch {
    // Fallback sang Base64
  }

  // Fallback an toàn
  return compressImage(file, { maxWidth, maxHeight, quality })
}
