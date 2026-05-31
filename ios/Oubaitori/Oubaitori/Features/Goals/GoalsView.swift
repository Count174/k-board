import SwiftUI

struct GoalsView: View {
    @StateObject private var vm = GoalsViewModel()

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                ScrollView {
                    LazyVStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(vm.activeGoals, id: \.id) { g in
                            goalCard(g)
                        }

                        if !vm.completedGoals.isEmpty {
                            Text("Выполнено")
                                .font(DesignTokens.Typography.caption)
                                .foregroundStyle(DesignTokens.Colors.textSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, DesignTokens.Spacing.sm)
                            ForEach(vm.completedGoals, id: \.id) { g in
                                goalCard(g)
                            }
                        }
                    }
                    .padding(DesignTokens.Spacing.md)
                    .padding(.bottom, 88)
                }

                OBFloatingAddButton { vm.startCreate() }
                    .padding(.trailing, DesignTokens.Spacing.md)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
            .navigationTitle("Цели")
            .navigationBarTitleDisplayMode(.large)
            .task { await vm.load() }
            .refreshable { await vm.load() }
            .sheet(item: $vm.selectedGoal) { g in
                checkinSheet(g)
            }
            .sheet(isPresented: $vm.showForm) {
                formSheet
            }
        }
    }

    // MARK: - Card

    private func tint(for g: GoalDTO) -> Color {
        switch g.type {
        case .task: return DesignTokens.Colors.goalEducation
        case .reduce: return DesignTokens.Colors.goalHealth
        case .habit: return DesignTokens.Colors.accent
        case .build_up: return DesignTokens.Colors.goalFinance
        }
    }

    private func goalCard(_ g: GoalDTO) -> some View {
        OBCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                    Text(g.resolvedIcon)
                        .font(.system(size: 30))
                        .frame(width: 52, height: 52)
                        .background(tint(for: g).opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 14))

                    VStack(alignment: .leading, spacing: 4) {
                        Text(g.title)
                            .font(DesignTokens.Typography.headline)
                            .foregroundStyle(DesignTokens.Colors.textPrimary)
                        Text("\(g.type.emoji) \(g.type.label)")
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.textSecondary)
                    }
                    Spacer()
                    if g.type != .task {
                        OBCircularProgress(
                            progress: g.progress,
                            tint: tint(for: g),
                            label: "\(Int(g.progress * 100))%"
                        )
                        .frame(width: 48, height: 48)
                    }
                }

                cardDetail(g)
            }
        }
        .contextMenu {
            Button { vm.startEdit(g) } label: { Label("Редактировать", systemImage: "pencil") }
            Button(role: .destructive) { Task { await vm.deleteGoal(g) } } label: {
                Label("Удалить", systemImage: "trash")
            }
        }
    }

    @ViewBuilder
    private func cardDetail(_ g: GoalDTO) -> some View {
        switch g.type {
        case .task:
            HStack {
                if let d = g.target_date {
                    Text("до \(formatDate(d))")
                        .font(DesignTokens.Typography.caption)
                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                }
                Spacer()
                Button(g.completed ? "Вернуть" : "Выполнено") {
                    Task { await vm.toggleTaskDone(g) }
                }
                .font(DesignTokens.Typography.caption)
                .foregroundStyle(g.completed ? DesignTokens.Colors.textSecondary : DesignTokens.Colors.accent)
            }
        case .habit:
            HStack {
                Text("\(Int(g.period_count ?? 0)) / \(Int(g.target ?? 0)) \(g.unit ?? "раз") за неделю")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(tint(for: g))
                Text("🔥 \(Int(g.streak ?? 0))")
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.textSecondary)
                Spacer()
                Button("Отметить") { Task { await vm.markHabitToday(g) } }
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.accent)
            }
        case .build_up, .reduce:
            HStack {
                Text(progressLabel(g))
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(tint(for: g))
                Spacer()
                Button("Обновить") { vm.selectedGoal = g }
                    .font(DesignTokens.Typography.caption)
                    .foregroundStyle(DesignTokens.Colors.accent)
            }
        }
    }

    private func progressLabel(_ g: GoalDTO) -> String {
        let v = Int(g.last_value ?? 0)
        let t = Int(g.target ?? 0)
        let u = g.unit ?? ""
        return "\(v) / \(t) \(u)"
    }

    private func formatDate(_ iso: String) -> String {
        let inF = DateFormatter()
        inF.dateFormat = "yyyy-MM-dd"
        inF.locale = Locale(identifier: "en_US_POSIX")
        let outF = DateFormatter()
        outF.dateFormat = "dd.MM.yyyy"
        if let d = inF.date(from: iso) { return outF.string(from: d) }
        return iso
    }

    // MARK: - Form

    private var formSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.md) {
                    typePicker

                    HStack(spacing: 10) {
                        Text(vm.previewIcon)
                            .font(.system(size: 26))
                            .frame(width: 48, height: 48)
                            .background(DesignTokens.Colors.card)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        OBTextField(placeholder: "Название цели", text: $vm.formTitle)
                    }

                    if vm.formType == .habit {
                        OBTextField(placeholder: "Сколько раз в неделю", text: $vm.formTarget)
                            .keyboardType(.numberPad)
                        OBTextField(placeholder: "Единица (раз, ч…)", text: $vm.formUnit)
                    }

                    if vm.formType.isNumeric {
                        OBTextField(
                            placeholder: vm.formType == .reduce ? "Целевое значение (до)" : "Целевое значение",
                            text: $vm.formTarget
                        )
                        .keyboardType(.decimalPad)
                        OBTextField(placeholder: "Единица (₽, кг, км…)", text: $vm.formUnit)
                        OBTextField(
                            placeholder: vm.formType == .reduce ? "Текущее значение (старт)" : "Стартовое значение (необязательно)",
                            text: $vm.formStart
                        )
                        .keyboardType(.decimalPad)
                    }

                    Toggle("Указать срок", isOn: $vm.formHasDate)
                        .tint(DesignTokens.Colors.accent)
                    if vm.formHasDate {
                        DatePicker("Срок", selection: $vm.formDate, displayedComponents: .date)
                            .datePickerStyle(.compact)
                    }

                    if let error = vm.error {
                        Text(error)
                            .font(DesignTokens.Typography.caption)
                            .foregroundStyle(DesignTokens.Colors.danger)
                    }

                    OBButton(title: vm.isEditing ? "Сохранить" : "Создать", horizontalPadding: DesignTokens.Spacing.lg) {
                        Task { await vm.saveForm() }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.md)
                }
                .padding(DesignTokens.Spacing.lg)
            }
            .obScreenBackground(showPetals: false)
            .navigationTitle(vm.isEditing ? "Редактировать" : "Новая цель")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { vm.showForm = false }
                }
            }
        }
        .presentationDetents([.large])
    }

    private var typePicker: some View {
        HStack(spacing: 8) {
            ForEach(GoalType.allCases) { t in
                Button {
                    vm.formType = t
                } label: {
                    VStack(spacing: 6) {
                        Text(t.emoji).font(.system(size: 20))
                        Text(t.label).font(DesignTokens.Typography.caption)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(vm.formType == t ? DesignTokens.Colors.accent.opacity(0.18) : DesignTokens.Colors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(vm.formType == t ? DesignTokens.Colors.accent : Color.clear, lineWidth: 1.5)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(vm.formType == t ? DesignTokens.Colors.textPrimary : DesignTokens.Colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Check-in

    private func checkinSheet(_ g: GoalDTO) -> some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.md) {
                Text(g.title)
                    .font(DesignTokens.Typography.headline)
                OBTextField(placeholder: "Текущее значение", text: $vm.checkinValue)
                    .keyboardType(.decimalPad)
                OBButton(title: "Сохранить", horizontalPadding: DesignTokens.Spacing.lg) {
                    Task { await vm.submitCheckin() }
                }
                .padding(.horizontal, DesignTokens.Spacing.md)
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .obScreenBackground(showPetals: false)
            .navigationTitle("Чек-ин")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { vm.selectedGoal = nil }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

extension GoalDTO: Hashable {
    static func == (lhs: GoalDTO, rhs: GoalDTO) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}
