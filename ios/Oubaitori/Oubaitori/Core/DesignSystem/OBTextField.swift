import SwiftUI

struct OBTextField: View {
    let placeholder: String
    @Binding var text: String
    var isSecure = false

    var body: some View {
        field
            .padding(.horizontal, 14)
            .padding(.vertical, 14)
            .background(DesignTokens.Colors.inputBackground)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.input))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.input)
                    .stroke(DesignTokens.Colors.cardBorder, lineWidth: 1)
            )
    }

    @ViewBuilder
    private var field: some View {
        let style = DesignTokens.Typography.body
        if isSecure {
            SecureField(placeholder, text: $text)
                .font(style)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        } else {
            TextField(placeholder, text: $text)
                .font(style)
                .foregroundStyle(DesignTokens.Colors.textPrimary)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
    }
}
