// OCR das páginas (macOS Vision). Uso: swift ocr.swift saida.json pagina1.png pagina2.png ...
// Saída: { "arquivo.png": [[texto, x, y, w, h], ...] } com coordenadas normalizadas (origem embaixo à esquerda).
import Foundation
import Vision
import AppKit

let args = CommandLine.arguments
var out: [String: [[Any]]] = [:]
for path in args.dropFirst(2) {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.recognitionLanguages = ["pt-BR", "en-US", "es-ES"]
    req.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg).perform([req])
    var lines: [[Any]] = []
    for obs in req.results ?? [] {
        guard let t = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox
        lines.append([t.string, b.minX, b.minY, b.width, b.height])
    }
    out[(path as NSString).lastPathComponent] = lines
}
let data = try JSONSerialization.data(withJSONObject: out)
try data.write(to: URL(fileURLWithPath: args[1]))
