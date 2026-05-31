import Foundation

// Зеркало backend/utils/goalIcon.js — только для мгновенного превью в форме.
// При сохранении авторитетен бэкенд.
enum GoalIcon {
    static let defaultIcon = "🎯"

    private static let rules: [(String, [String])] = [
        ("🚭", ["курени", "курить", "куриль", "сигарет", "вейп", "никотин", "smok", "cigarett", "vape"]),
        ("🍺", ["алкогол", "выпивк", "пиво", "вино", "бухл", "alcohol", "beer", "wine", "drink"]),
        ("💰", ["заработа", "зарабат", "доход", "зарплат", "накоп", "сбереж", "деньг", "капитал", "рубл", "₽", "money", "earn", "save", "income", "salary", "budget", "бюджет"]),
        ("⚖️", ["похуд", "вес", "кг", "килограм", "диет", "жир", "weight", "lose weight", "diet", "fat"]),
        ("🏃", ["бег", "пробеж", "марафон", "run", "jog", "marathon", "кросс"]),
        ("💪", ["зал", "трениров", "спортзал", "мышц", "качал", "отжим", "подтяг", "присед", "фитнес", "gym", "workout", "muscle", "fitness", "strength", "сила"]),
        ("📚", ["книг", "чита", "прочит", "чтени", "book", "read", "литератур"]),
        ("🎓", ["язык", "английск", "испанск", "немецк", "учить", "учеб", "курс", "образован", "диплом", "универ", "study", "learn", "language", "course", "english"]),
        ("💻", ["код", "программ", "разработ", "проект", "стартап", "code", "program", "dev", "project", "startup"]),
        ("💧", ["вода", "воды", "пить вод", "water", "гидрат"]),
        ("😴", ["сон", "спать", "высыпа", "режим сна", "sleep"]),
        ("🧘", ["медитац", "йог", "осознан", "meditat", "yoga", "mindful", "дыхан"]),
        ("✈️", ["путешеств", "поездк", "страну", "страны", "travel", "trip", "отпуск", "vacation", "полёт"]),
        ("🏠", ["квартир", "ремонт", "ипотек", "жиль", "дом куп", "house", "home", "apartment", "mortgage"]),
        ("🚗", ["машин", "авто", "автомобил", "права", "car", "driv", "лиценз"]),
        ("🥗", ["питани", "еда", "правильно ест", "овощ", "здоров пита", "nutrition", "healthy eat", "meal"]),
        ("🎨", ["рисова", "рисунок", "живопис", "art", "draw", "paint", "творч"]),
        ("🎸", ["гитар", "музык", "инструмент", "пиани", "guitar", "music", "piano"]),
        ("🧠", ["мозг", "память", "фокус", "продуктив", "focus", "productiv", "brain"]),
        ("❤️", ["здоровь", "health", "давлени", "сердц"]),
    ]

    static func derive(_ title: String) -> String {
        let t = title.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return defaultIcon }
        for (emoji, keywords) in rules {
            for kw in keywords where t.contains(kw) {
                return emoji
            }
        }
        return defaultIcon
    }
}
