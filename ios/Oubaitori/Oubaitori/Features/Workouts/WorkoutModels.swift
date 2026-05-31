import Foundation

struct WorkoutPlanDTO: Decodable, Identifiable, Hashable {
    let id: Int
    let name: String
    let sport_label: String?
    let weekdays: [Int]?
    let exercises: [WorkoutExerciseDTO]?

    static func == (lhs: WorkoutPlanDTO, rhs: WorkoutPlanDTO) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    enum CodingKeys: String, CodingKey {
        case id, name, sport_label, weekdays, exercises
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(Int.self, forKey: .id)
        name = try c.decode(String.self, forKey: .name)
        sport_label = try c.decodeIfPresent(String.self, forKey: .sport_label)
        weekdays = try c.decodeIfPresent([Int].self, forKey: .weekdays)
        exercises = (try? c.decode([WorkoutExerciseDTO].self, forKey: .exercises)) ?? []
    }
}

struct WorkoutExerciseDTO: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let kind: String?
    let sets: Int?
    let reps: String?
    let sets_detail: String?
    let set_rows: [WorkoutSetRowDTO]?

    enum CodingKeys: String, CodingKey {
        case name, kind, sets, reps, sets_detail, set_rows
        case weight_kg, duration_min, distance_km, notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decode(String.self, forKey: .name)
        kind = try c.decodeIfPresent(String.self, forKey: .kind)
        sets = Self.decodeInt(from: c, forKey: .sets)
        reps = Self.decodeString(from: c, forKey: .reps)
        sets_detail = try c.decodeIfPresent(String.self, forKey: .sets_detail)
        set_rows = try c.decodeIfPresent([WorkoutSetRowDTO].self, forKey: .set_rows)
    }

    private static func decodeInt(from c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> Int? {
        if let v = try? c.decode(Int.self, forKey: key) { return v }
        if let s = try? c.decode(String.self, forKey: key), let v = Int(s) { return v }
        return nil
    }

    private static func decodeString(from c: KeyedDecodingContainer<CodingKeys>, forKey key: CodingKeys) -> String? {
        if let s = try? c.decode(String.self, forKey: key) { return s }
        if let i = try? c.decode(Int.self, forKey: key) { return String(i) }
        if let d = try? c.decode(Double.self, forKey: key) { return String(d) }
        return nil
    }

    var displayDetail: String? {
        if let sets_detail, !sets_detail.isEmpty { return sets_detail }
        if let rows = set_rows, !rows.isEmpty {
            return rows.map(\.displayLine).joined(separator: " · ")
        }
        if let sets, let reps, !reps.isEmpty { return "\(sets) × \(reps)" }
        if let sets { return "\(sets) подходов" }
        return nil
    }
}

struct WorkoutSetRowDTO: Decodable {
    let reps: String?
    let weight_kg: Double?
    let duration_min: Int?

    var displayLine: String {
        var parts: [String] = []
        if let reps, !reps.isEmpty { parts.append("\(reps) повт.") }
        if let w = weight_kg, w > 0 { parts.append("\(w) кг") }
        if let d = duration_min, d > 0 { parts.append("\(d) мин") }
        return parts.isEmpty ? "—" : parts.joined(separator: " ")
    }

    enum CodingKeys: String, CodingKey {
        case reps, weight_kg, duration_min
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .reps) {
            reps = s
        } else if let i = try? c.decode(Int.self, forKey: .reps) {
            reps = String(i)
        } else {
            reps = nil
        }
        weight_kg = try c.decodeIfPresent(Double.self, forKey: .weight_kg)
        duration_min = try c.decodeIfPresent(Int.self, forKey: .duration_min)
    }
}
