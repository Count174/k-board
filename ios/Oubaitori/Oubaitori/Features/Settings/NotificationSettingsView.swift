import SwiftUI

struct NotificationSettingsView: View {
    @StateObject private var push = PushNotificationService.shared
    @State private var masterEnabled = true
    @State private var medications = true
    @State private var workouts = true
    @State private var expenses = true
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        List {
            if push.authorizationStatus == .denied {
                Section {
                    Text("Уведомления отключены в системных настройках iOS. Включите их для напоминаний о лекарствах, тренировках и расходах.")
                        .font(DesignTokens.Typography.callout)
                        .foregroundStyle(DesignTokens.Colors.textSecondary)
                    Button("Открыть настройки iOS") {
                        push.openSystemSettings()
                    }
                    .foregroundStyle(DesignTokens.Colors.accent)
                }
                .listRowBackground(DesignTokens.Colors.card)
            }

            Section {
                Toggle("Уведомления", isOn: $masterEnabled)
                    .onChange(of: masterEnabled) { _, _ in Task { await save() } }
                Toggle("Лекарства и витамины", isOn: $medications)
                    .disabled(!masterEnabled)
                    .onChange(of: medications) { _, _ in Task { await save() } }
                Toggle("Тренировки", isOn: $workouts)
                    .disabled(!masterEnabled)
                    .onChange(of: workouts) { _, _ in Task { await save() } }
                Toggle("Расходы (вечером)", isOn: $expenses)
                    .disabled(!masterEnabled)
                    .onChange(of: expenses) { _, _ in Task { await save() } }
            } header: {
                Text("Типы напоминаний")
            } footer: {
                Text("Расходы: если за день не было ни одной записи в финансах, в 19:30 придёт напоминание.")
            }
            .listRowBackground(DesignTokens.Colors.card)

            Section {
                Button("Запросить разрешение снова") {
                    Task { await push.requestPermissionAndRegister() }
                }
                .foregroundStyle(DesignTokens.Colors.accent)
            }
            .listRowBackground(DesignTokens.Colors.card)

            if let error {
                Section {
                    Text(error)
                        .foregroundStyle(DesignTokens.Colors.danger)
                }
                .listRowBackground(DesignTokens.Colors.card)
            }
        }
        .scrollContentBackground(.hidden)
        .obScreenBackground(showPetals: false)
        .navigationTitle("Уведомления")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        loading = true
        defer { loading = false }
        await push.refreshAuthorizationStatus()
        if let prefs = await push.loadPreferences() {
            masterEnabled = prefs.enabled ?? true
            medications = prefs.medications ?? true
            workouts = prefs.workouts ?? true
            expenses = prefs.expenses ?? true
        }
    }

    private func save() async {
        error = nil
        do {
            try await push.savePreferences(
                PatchDevicePreferencesBody(
                    enabled: masterEnabled,
                    medications: medications,
                    workouts: workouts,
                    expenses: expenses
                )
            )
        } catch let err {
            error = err.localizedDescription
        }
    }
}
