import SwiftUI

struct TasksView: View {
    @StateObject private var vm = TasksViewModel()
    @State private var showAdd = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                VStack(spacing: DesignTokens.Spacing.md) {
                    OBSegmentedControl(selection: $vm.segment, options: TodoColumn.allCases)
                        .padding(.horizontal, DesignTokens.Spacing.md)

                    ScrollView {
                        LazyVStack(spacing: DesignTokens.Spacing.sm) {
                            ForEach(vm.filteredItems) { t in
                                taskRow(t)
                            }
                        }
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.bottom, 88)
                    }
                }

                OBFloatingAddButton { showAdd = true }
                    .padding(.trailing, DesignTokens.Spacing.md)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
            .navigationTitle("Задачи")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(DesignTokens.Colors.background, for: .navigationBar)
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .sheet(isPresented: $showAdd) {
                addTaskSheet
            }
            .obUndoToast($vm.undoToast)
        }
    }

    private func taskRow(_ t: TodoDTO) -> some View {
        Button {
            Task { await vm.complete(t) }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: t.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(t.isCompleted ? DesignTokens.Colors.accent : DesignTokens.Colors.textTertiary)

                VStack(alignment: .leading, spacing: 6) {
                    Text(t.text)
                        .font(DesignTokens.Typography.headline)
                        .foregroundStyle(DesignTokens.Colors.textPrimary)
                        .multilineTextAlignment(.leading)
                    HStack {
                        if let time = t.time, !time.isEmpty {
                            Text(time)
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textSecondary)
                        }
                        OBCategoryPill(title: "Личное", color: DesignTokens.Colors.categoryPersonal)
                    }
                }
                Spacer()
                Circle()
                    .fill(DesignTokens.Colors.categoryPersonal)
                    .frame(width: 8, height: 8)
            }
            .padding(DesignTokens.Spacing.md)
            .background(DesignTokens.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.card))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.Radius.card)
                    .stroke(DesignTokens.Colors.cardBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var addTaskSheet: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                OBTextField(placeholder: "Название задачи", text: $vm.newText)
                OBButton(title: "Сохранить", horizontalPadding: DesignTokens.Spacing.lg) {
                    Task {
                        await vm.add()
                        showAdd = false
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .obScreenBackground(showPetals: false)
            .navigationTitle("Новая задача")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Готово") { showAdd = false }
                        .foregroundStyle(DesignTokens.Colors.accent)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
