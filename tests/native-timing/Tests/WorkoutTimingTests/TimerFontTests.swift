import CoreText
import Foundation
import XCTest

final class TimerFontTests: XCTestCase {
    let faces = ["LiftTimer-BoldItalic", "LiftSegmentGhost-BoldItalic"]
    let dashes: [UInt16] = [0x002D, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2212, 0xFF0D]

    func font(_ name: String, size: CGFloat) throws -> CTFont {
        let directory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
            .appendingPathComponent("../../../../ios/App/LiftActivity/Fonts").standardizedFileURL
        let url = directory.appendingPathComponent(name + ".ttf")
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        // Register the actual shipped resources; fallback is detected per run.
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        let result = CTFontCreateWithName(name as CFString, size, nil)
        XCTAssertEqual(CTFontCopyPostScriptName(result) as String, name)
        return result
    }

    func line(_ text: String, font: CTFont) -> CTLine {
        CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
        ]))
    }

    func testReducedCadenceDashesNeverFallBackOrShiftSeconds() throws {
        for face in faces {
            for size: CGFloat in [12, 23, 30] {
                let f = try font(face, size: size)
                let expectedWidth = CTLineGetTypographicBounds(line("01:00", font: f), nil, nil, nil)
                for dash in dashes {
                    let text = "01:" + String(UnicodeScalar(dash)!) + String(UnicodeScalar(dash)!)
                    let rendered = line(text, font: f)
                    let runs = CTLineGetGlyphRuns(rendered) as! [CTRun]
                    for run in runs {
                        let attributes = CTRunGetAttributes(run) as NSDictionary
                        let runFont = attributes[kCTFontAttributeName] as! CTFont
                        XCTAssertEqual(CTFontCopyPostScriptName(runFont) as String, face, text)
                    }
                    XCTAssertEqual(CTLineGetTypographicBounds(rendered, nil, nil, nil), expectedWidth,
                                   accuracy: 0.01, text)
                }
            }
        }
    }

    func testGhostDashesUseFullEightAndMinutePaddingStaysAligned() throws {
        let ghost = try font(faces[1], size: 30)
        var eight: CGGlyph = 0
        var eightChar: UniChar = 0x38
        XCTAssertTrue(CTFontGetGlyphsForCharacters(ghost, &eightChar, &eight, 1))
        let eightPath = CTFontCreatePathForGlyph(ghost, eight, nil)
        for var dash in dashes {
            var glyph: CGGlyph = 0
            XCTAssertTrue(CTFontGetGlyphsForCharacters(ghost, &dash, &glyph, 1))
            XCTAssertEqual(CTFontCreatePathForGlyph(ghost, glyph, nil), eightPath)
        }
        let lit = try font(faces[0], size: 30)
        for text in ["1:00", "0:59", "00:00", "10:00", "1:––"] {
            XCTAssertEqual(CTLineGetTypographicBounds(line(text, font: lit), nil, nil, nil),
                           CTLineGetTypographicBounds(line(text, font: ghost), nil, nil, nil), accuracy: 0.01)
        }
        XCTAssertEqual(CTLineGetTypographicBounds(line("1:00", font: lit), nil, nil, nil),
                       CTLineGetTypographicBounds(line("01:00", font: lit), nil, nil, nil), accuracy: 0.01)
    }
}
