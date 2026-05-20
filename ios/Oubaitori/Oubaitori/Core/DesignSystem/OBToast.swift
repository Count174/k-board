import SwiftUI

struct UndoToast: Equatable {
    let message: String
    let undoTitle: String
    let onUndo: () -> Void

    static func == (lhs: UndoToast, rhs: UndoToast) -> Bool {
        lhs.message == rhs.message && lhs.undoTitle == rhs.undoTitle
    }
}

struct OBUndoToastModifier: ViewModifier {
    @Binding var toast: UndoToast?

    func body(content: Content) -> some View {
        ZStack(alignment: .bottom) {
            content
            if let toast {
                HStack(spacing: 12) {
                    Text(toast.message)
                        .font(DesignTokens.Typography.callout)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                    Spacer(minLength: 8)
                    Button(toast.undoTitle) {
                        toast.onUndo()
                        self.toast = nil
                    }
                    .font(DesignTokens.Typography.callout.weight(.semibold))
                    .foregroundStyle(DesignTokens.Colors.accent)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(DesignTokens.Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(DesignTokens.Colors.cardBorder, lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.35), radius: 12, y: 4)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .padding(.bottom, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .onAppear {
                    Task {
                        try? await Task.sleep(nanoseconds: 5_000_000_000)
                        if self.toast == toast {
                            withAnimation { self.toast = nil }
                        }
                    }
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: toast)
    }
}

extension View {
    func obUndoToast(_ toast: Binding<UndoToast?>) -> some View {
        modifier(OBUndoToastModifier(toast: toast))
    }
}

struct OBFloatingAddButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color(hex: 0x0A1F18))
                .frame(width: 56, height: 56)
                .background(DesignTokens.Colors.accent)
                .clipShape(Circle())
                .shadow(color: DesignTokens.Colors.accentGlow, radius: 10, y: 4)
        }
        .accessibilityLabel("Добавить")
    }
}
