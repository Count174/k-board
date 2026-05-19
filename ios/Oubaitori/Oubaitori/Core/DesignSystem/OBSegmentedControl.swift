import SwiftUI

struct OBSegmentedControl<T: Hashable & CustomStringConvertible>: View {
    @Binding var selection: T
    let options: [T]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                Button {
                    selection = option
                } label: {
                    Text(option.description)
                        .font(DesignTokens.Typography.callout.weight(.medium))
                        .foregroundStyle(
                            selection == option
                                ? Color(hex: 0x0A1F18)
                                : DesignTokens.Colors.textSecondary
                        )
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(
                            selection == option
                                ? AnyShapeStyle(DesignTokens.Colors.accent)
                                : AnyShapeStyle(Color.clear)
                        )
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(DesignTokens.Colors.card)
        .clipShape(Capsule())
        .overlay(Capsule().stroke(DesignTokens.Colors.cardBorder, lineWidth: 1))
    }
}
