#!/usr/bin/env swift

import AppKit
import Foundation

let fileManager = FileManager.default
let root = URL(fileURLWithPath: fileManager.currentDirectoryPath)
let sourceURL = root.appendingPathComponent("build/slothssh-master.png")
let resourcesURL = root.appendingPathComponent("android/app/src/main/res")
let buildURL = root.appendingPathComponent("build")

guard let logo = NSImage(contentsOf: sourceURL) else {
    fatalError("Unable to load SlothSSH logo at \(sourceURL.path)")
}

let navy = NSColor(calibratedRed: 0.020, green: 0.045, blue: 0.105, alpha: 1)
let blue = NSColor(calibratedRed: 0.090, green: 0.390, blue: 1.000, alpha: 1)
let violet = NSColor(calibratedRed: 0.440, green: 0.150, blue: 1.000, alpha: 1)
let white = NSColor(calibratedRed: 0.965, green: 0.985, blue: 1.000, alpha: 1)

func bitmap(size: Int) -> NSBitmapImageRep {
    guard let result = NSBitmapImageRep(
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
        fatalError("Unable to allocate \(size)x\(size) icon")
    }
    result.size = NSSize(width: size, height: size)
    return result
}

func brandFont(size: CGFloat) -> NSFont {
    NSFont(name: "ArialRoundedMTBold", size: size)
        ?? NSFont.systemFont(ofSize: size, weight: .heavy)
}

func drawBrandForeground() {
    NSGraphicsContext.current?.imageInterpolation = .high

    let logoRect = NSRect(x: 274, y: 382, width: 476, height: 476)
    logo.draw(in: logoRect, from: .zero, operation: .sourceOver, fraction: 1)

    let font = brandFont(size: 108)
    let shadow = NSShadow()
    shadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.72)
    shadow.shadowBlurRadius = 15
    shadow.shadowOffset = NSSize(width: 0, height: -5)

    let sloth = NSAttributedString(string: "Sloth", attributes: [
        .font: font,
        .foregroundColor: white,
        .shadow: shadow,
        .kern: -4
    ])
    let ssh = NSAttributedString(string: "SSH", attributes: [
        .font: font,
        .foregroundColor: NSColor(calibratedRed: 0.33, green: 0.63, blue: 1.0, alpha: 1),
        .shadow: shadow,
        .kern: -4
    ])

    let totalWidth = sloth.size().width + ssh.size().width
    let startX = (1024 - totalWidth) / 2
    sloth.draw(at: NSPoint(x: startX, y: 256))
    ssh.draw(at: NSPoint(x: startX + sloth.size().width, y: 256))
}

func render(size: Int, backgroundShape: String?) -> Data {
    let imageRep = bitmap(size: size)
    guard let context = NSGraphicsContext(bitmapImageRep: imageRep) else {
        fatalError("Unable to create icon graphics context")
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.cgContext.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()

    if let backgroundShape {
        let bounds = NSRect(x: 24, y: 24, width: 976, height: 976)
        let path: NSBezierPath
        if backgroundShape == "circle" {
            path = NSBezierPath(ovalIn: bounds)
        } else {
            path = NSBezierPath(roundedRect: bounds, xRadius: 224, yRadius: 224)
        }
        path.addClip()
        NSGradient(colorsAndLocations: (navy, 0), (blue, 0.68), (violet, 1))?.draw(in: path, angle: -45)

        let glow = NSBezierPath(ovalIn: NSRect(x: 118, y: 470, width: 788, height: 470))
        NSColor(calibratedRed: 0.03, green: 0.85, blue: 0.95, alpha: 0.11).setFill()
        glow.fill()
    }

    drawBrandForeground()
    context.flushGraphics()
    NSGraphicsContext.restoreGraphicsState()

    guard let data = imageRep.representation(using: .png, properties: [:]) else {
        fatalError("Unable to encode launcher icon")
    }
    return data
}

func write(_ data: Data, to relativePath: String) {
    let url = resourcesURL.appendingPathComponent(relativePath)
    try! fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! data.write(to: url, options: .atomic)
    print("Generated \(url.path)")
}

func writeProjectAsset(_ data: Data, to relativePath: String) {
    let url = root.appendingPathComponent(relativePath)
    try! fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try! data.write(to: url, options: .atomic)
    print("Generated \(url.path)")
}

extension Data {
    mutating func appendLittleEndian<T: FixedWidthInteger>(_ value: T) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { bytes in
            append(contentsOf: bytes)
        }
    }
}

func windowsIcon(images: [(size: Int, data: Data)]) -> Data {
    var icon = Data()
    icon.appendLittleEndian(UInt16(0))
    icon.appendLittleEndian(UInt16(1))
    icon.appendLittleEndian(UInt16(images.count))

    var offset = 6 + images.count * 16
    for image in images {
        icon.append(UInt8(image.size == 256 ? 0 : image.size))
        icon.append(UInt8(image.size == 256 ? 0 : image.size))
        icon.append(UInt8(0))
        icon.append(UInt8(0))
        icon.appendLittleEndian(UInt16(1))
        icon.appendLittleEndian(UInt16(32))
        icon.appendLittleEndian(UInt32(image.data.count))
        icon.appendLittleEndian(UInt32(offset))
        offset += image.data.count
    }

    for image in images {
        icon.append(image.data)
    }
    return icon
}

write(render(size: 1024, backgroundShape: nil), to: "drawable-nodpi/slothssh_launcher_foreground.png")

let densities = [
    ("mipmap-mdpi", 48),
    ("mipmap-hdpi", 72),
    ("mipmap-xhdpi", 96),
    ("mipmap-xxhdpi", 144),
    ("mipmap-xxxhdpi", 192)
]

for (folder, size) in densities {
    write(render(size: size, backgroundShape: "rounded"), to: "\(folder)/ic_launcher.png")
    write(render(size: size, backgroundShape: "circle"), to: "\(folder)/ic_launcher_round.png")
}

let desktopMaster = render(size: 1024, backgroundShape: "rounded")
writeProjectAsset(desktopMaster, to: "build/slothssh-1024.png")
writeProjectAsset(render(size: 512, backgroundShape: "rounded"), to: "electron/assets/slothssh-icon.png")
writeProjectAsset(render(size: 512, backgroundShape: "rounded"), to: "public/slothssh-icon.png")

let iconset = [
    ("icon_16x16.png", 16),
    ("icon_16x16@2x.png", 32),
    ("icon_32x32.png", 32),
    ("icon_32x32@2x.png", 64),
    ("icon_128x128.png", 128),
    ("icon_128x128@2x.png", 256),
    ("icon_256x256.png", 256),
    ("icon_256x256@2x.png", 512),
    ("icon_512x512.png", 512),
    ("icon_512x512@2x.png", 1024)
]

for (filename, size) in iconset {
    writeProjectAsset(render(size: size, backgroundShape: "rounded"), to: "build/slothssh.iconset/\(filename)")
}

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = [
    "-c", "icns",
    "-o", buildURL.appendingPathComponent("slothssh.icns").path,
    buildURL.appendingPathComponent("slothssh.iconset").path
]
try! iconutil.run()
iconutil.waitUntilExit()
guard iconutil.terminationStatus == 0 else {
    fatalError("iconutil failed with status \(iconutil.terminationStatus)")
}
print("Generated \(buildURL.appendingPathComponent("slothssh.icns").path)")

let icoImages = [16, 24, 32, 48, 64, 128, 256].map {
    (size: $0, data: render(size: $0, backgroundShape: "rounded"))
}
writeProjectAsset(windowsIcon(images: icoImages), to: "build/slothssh.ico")
