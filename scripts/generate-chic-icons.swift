import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceURL = root.appendingPathComponent("public/ChICLogo_NoText_2026-07-02.png")

guard var source = NSImage(contentsOf: sourceURL) else {
    fatalError("Could not load source image at \(sourceURL.path)")
}

guard
    let sourceTiff = source.tiffRepresentation,
    let sourceRep = NSBitmapImageRep(data: sourceTiff)
else {
    fatalError("Could not read bitmap pixels from \(sourceURL.path)")
}

let sourcePixelSize = NSSize(width: sourceRep.pixelsWide, height: sourceRep.pixelsHigh)
source.size = sourcePixelSize

func isArtworkPixel(_ color: NSColor) -> Bool {
    guard let rgb = color.usingColorSpace(.deviceRGB) else {
        return false
    }

    if rgb.alphaComponent < 0.05 {
        return false
    }

    let red = rgb.redComponent
    let green = rgb.greenComponent
    let blue = rgb.blueComponent
    let distanceFromWhite = sqrt(
        pow(1 - red, 2) +
        pow(1 - green, 2) +
        pow(1 - blue, 2)
    )

    return distanceFromWhite > 0.05
}

func artworkBounds(in rep: NSBitmapImageRep) -> NSRect {
    var minX = rep.pixelsWide
    var minY = rep.pixelsHigh
    var maxX = 0
    var maxY = 0

    for y in 0..<rep.pixelsHigh {
        for x in 0..<rep.pixelsWide {
            guard let color = rep.colorAt(x: x, y: y), isArtworkPixel(color) else {
                continue
            }

            minX = min(minX, x)
            minY = min(minY, y)
            maxX = max(maxX, x)
            maxY = max(maxY, y)
        }
    }

    if minX > maxX || minY > maxY {
        return NSRect(origin: .zero, size: sourcePixelSize)
    }

    let margin = 12
    let x = max(minX - margin, 0)
    let y = max(minY - margin, 0)
    let width = min(maxX + margin, rep.pixelsWide - 1) - x + 1
    let height = min(maxY + margin, rep.pixelsHigh - 1) - y + 1

    return NSRect(
        x: x,
        y: rep.pixelsHigh - y - height,
        width: width,
        height: height
    )
}

let sourceCrop = artworkBounds(in: sourceRep)

let outputs: [(String, Int)] = [
    ("public/favicon.png", 64),
    ("public/img/icons/favicon-16x16.png", 16),
    ("public/img/icons/favicon-32x32.png", 32),
    ("public/img/icons/apple-touch-icon-60x60.png", 60),
    ("public/img/icons/apple-touch-icon-76x76.png", 76),
    ("public/img/icons/apple-touch-icon-120x120.png", 120),
    ("public/img/icons/apple-touch-icon-152x152.png", 152),
    ("public/img/icons/apple-touch-icon-180x180.png", 180),
    ("public/img/icons/apple-touch-icon.png", 180),
    ("public/img/icons/msapplication-icon-144x144.png", 144),
    ("public/img/icons/mstile-150x150.png", 150),
    ("public/img/icons/android-chrome-192x192.png", 192),
    ("public/img/icons/android-chrome-maskable-192x192.png", 192),
    ("public/img/icons/android-chrome-512x512.png", 512),
    ("public/img/icons/android-chrome-maskable-512x512.png", 512)
]

func makeIcon(size: Int, destination: URL) throws {
    let rect = NSRect(x: 0, y: 0, width: size, height: size)
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fatalError("Could not create bitmap for \(destination.path)")
    }

    rep.size = NSSize(width: size, height: size)

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSColor.clear.setFill()
    rect.fill()

    let circle = NSBezierPath(ovalIn: rect)
    circle.addClip()

    NSColor.white.setFill()
    circle.fill()

    let padding = CGFloat(size) * 0.08
    let available = CGFloat(size) - (padding * 2)
    let scale = min(available / sourceCrop.width, available / sourceCrop.height)
    let cropOriginInIcon = NSPoint(
        x: (CGFloat(size) - (sourceCrop.width * scale)) / 2,
        y: (CGFloat(size) - (sourceCrop.height * scale)) / 2
    )
    let drawRect = NSRect(
        x: cropOriginInIcon.x - (sourceCrop.minX * scale),
        y: cropOriginInIcon.y - (sourceCrop.minY * scale),
        width: sourcePixelSize.width * scale,
        height: sourcePixelSize.height * scale
    )

    source.draw(in: drawRect, from: NSRect(origin: .zero, size: sourcePixelSize), operation: .sourceOver, fraction: 1.0)
    NSGraphicsContext.restoreGraphicsState()

    guard let data = rep.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode \(destination.path)")
    }

    try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
    try data.write(to: destination)
}

for output in outputs {
    try makeIcon(size: output.1, destination: root.appendingPathComponent(output.0))
}
