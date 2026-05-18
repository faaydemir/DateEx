import { DateCycle } from '../src/parser/JustDate.ts'
import { parseDateEx } from '../src/parser/mapper.ts'

function test(input: string) {
    console.log(`\nTesting: "${input}"`)

    try {
        const expression = parseDateEx(input)
        const dateEx = expression.toDateEx()

        console.log(`  Expression type: ${expression.expr.type}`)
        console.log(`  DateEx value type: ${dateEx.valueType}`)

        if (dateEx.value instanceof DateCycle) {
            console.log("  Cycle Pattern:", dateEx.value.cyclePattern.map((unit) => ({
                type: unit.type,
                indexes: unit.indexes,
            })))
            const dates = dateEx.value.getDatesInRange(
                dateEx.value.firstDay,
                dateEx.value.firstDay.addDays(10),
            )
            console.log("  Dates in range:", dates.map((date) => date.firstDay.startTime().toISOString()))
        } else {
            console.log("  Dates:", dateEx.value.toArray().map((date) => ({
                type: date.type,
                from: date.firstDay.startTime().toISOString(),
                to: date.lastDay.startTime().toISOString(),
            })))
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(`  Error: ${message}`)
    }
}

test("Y2023-M1-Dm1")
test("M*-Dm1")
test("D+1")
test("M")
test("Y2025-M[1,2,3]")
test("Y2025-M[1>3]")
