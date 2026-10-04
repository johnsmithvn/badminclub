/**
 * Lớp phủ tối mờ cho modal tự dựng: phủ kín màn, bấm ra ngoài thì `onClose`. Khung bên trong tự
 * `e.stopPropagation()` để bấm vào nội dung không bị đóng. `align` = 'flex-end' cho dạng sheet dính đáy.
 */
export function ModalOverlay({ onClose, align = 'center', padding = 16, children }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: align,
        justifyContent: 'center',
        padding,
      }}
      onClick={onClose}
    >
      {children}
    </div>
  )
}
