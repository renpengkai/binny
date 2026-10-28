ObjC.import('Cocoa')
ObjC.import('ServiceManagement')

const W = 168
const H = 206
const CAT_W = 128
const CAT_H = 157
const WAKE_NAME = 'io.github.renpengkai.binny.wake'

let panel = null
let view = null
const faces = {}
let eyesImage = null

const state = {
  lid: 0,
  lidTarget: 0,
  tilt: 0,
  tiltTarget: 0,
  hopStart: 0,
  shakeStart: 0,
  gulpStart: 0,
  blinkStart: 0,
  nextBlink: 0,
  expression: 'calm',
  expressionUntil: 0,
  lastInteraction: 0,
  glance: { x: 0, y: 0.4 },
  nextGlance: 0,
  message: null,
  messageUntil: 0,
  swallowing: false,
  hovering: false,
  pressing: false,
  dragged: false,
  anchor: { x: 0, y: 0 },
  origin: { x: 0, y: 0 },
  face: 'idle',
}

const ink = $.NSColor.colorWithSRGBRedGreenBlueAlpha(0.25, 0.24, 0.28, 1)
const bubbleFill = $.NSColor.colorWithSRGBRedGreenBlueAlpha(1, 0.99, 0.97, 0.96)
const blush = $.NSColor.colorWithSRGBRedGreenBlueAlpha(0.95, 0.58, 0.55, 1)

function now() { return Date.now() / 1000 }

function defaults() { return $.NSUserDefaults.standardUserDefaults }

function pref(key, fallback) {
  const value = defaults().objectForKey(key)
  if (value === null || value === undefined) return fallback
  return defaults().boolForKey(key)
}

function wake() {
  state.lastInteraction = now()
  if (state.expression === 'sleepy') state.expression = 'calm'
}

function say(text) {
  state.message = text
  state.messageUntil = now() + 2.4
}

function hop(text) {
  wake()
  state.hopStart = now()
  state.expression = 'happy'
  state.face = 'happy'
  state.expressionUntil = now() + 1.15
  if (text) say(text)
}

function pat() {
  const lines = ['喵', '呼噜', '再摸摸', '想吃文件']
  if (Math.random() < 0.34) hop(lines[Math.floor(Math.random() * lines.length)])
  else hop(null)
}

function syncFace() {
  if (state.swallowing || state.lid > 0.35 || state.expression === 'hungry') {
    state.face = 'alert'
  } else if (state.expression === 'nope') {
    state.face = 'alert'
  } else if (state.expression === 'happy') {
    state.face = 'happy'
  } else if (state.expression === 'sleepy') {
    state.face = 'sleepy'
  } else if (state.hovering) {
    state.face = 'greet'
  } else {
    state.face = 'idle'
  }
}

function step() {
  const t = now()
  state.lid += (state.lidTarget - state.lid) * 0.28
  state.tilt += (state.tiltTarget - state.tilt) * 0.22
  if (Math.abs(state.lidTarget - state.lid) < 0.004) state.lid = state.lidTarget
  if (!state.blinkStart && t > state.nextBlink) state.blinkStart = t
  if (state.blinkStart && t - state.blinkStart > 0.14) {
    state.blinkStart = 0
    state.nextBlink = t + 2.6 + Math.random() * 3.6
  }
  if (!state.hovering && t > state.nextGlance) {
    state.glance = { x: (Math.random() * 2 - 1) * 2.1, y: (Math.random() * 2 - 1) * 1.1 }
    state.nextGlance = t + 1.1 + Math.random() * 2.3
  }
  if (state.message && t > state.messageUntil) state.message = null
  if (t >= state.expressionUntil) {
    if (state.swallowing || state.lid > 0.28) state.expression = 'hungry'
    else if (t - state.lastInteraction > 42) state.expression = 'sleepy'
    else state.expression = 'calm'
  }
  syncFace()
}

function hopOffset() {
  if (!state.hopStart) return 0
  const p = (now() - state.hopStart) / 0.42
  if (p >= 1) { state.hopStart = 0; return 0 }
  return Math.sin(p * Math.PI) * 22
}

function shakeOffset() {
  if (!state.shakeStart) return 0
  const p = now() - state.shakeStart
  if (p > 0.42) { state.shakeStart = 0; return 0 }
  return Math.sin(p * 48) * 5 * (1 - p / 0.42)
}

function gulpAmount() {
  if (!state.gulpStart) return 0
  const p = (now() - state.gulpStart) / 0.38
  if (p >= 1) { state.gulpStart = 0; return 0 }
  return Math.sin(p * Math.PI)
}

function assetRoots() {
  const roots = []
  const resources = $.NSBundle.mainBundle.resourcePath
  if (resources) {
    roots.push(ObjC.unwrap(resources) + '/mascot')
    roots.push(ObjC.unwrap(resources))
  }
  roots.push('/Volumes/PKSSD/note/binny/assets/mascot')
  return roots
}

function loadNamedImage(name) {
  const roots = assetRoots()
  for (let i = 0; i < roots.length; i++) {
    const path = roots[i] + '/' + name
    const image = $.NSImage.alloc.initWithContentsOfFile(path)
    if (image && image.size.width > 0) return image
  }
  return null
}

function loadFaces() {
  ;['idle', 'happy', 'greet', 'sleepy', 'alert', 'read'].forEach(function (name) {
    if (!faces[name]) faces[name] = loadNamedImage('pet-face-' + name + '.png')
  })
  if (!eyesImage) eyesImage = loadNamedImage('pet-eyes.png')
}

function catOrigin() {
  return { x: (W - CAT_W) / 2, y: 8 }
}

function currentFaceImage() {
  loadFaces()
  return faces[state.face] || faces.idle
}

function blinkAlpha() {
  // 只在 idle 系叠闭眼层，和 mkdown 码猫一致
  if (state.face !== 'idle') return 0
  if (state.expression === 'sleepy') return 1
  if (!state.blinkStart) return 0
  const p = Math.min(1, Math.max(0, (now() - state.blinkStart) / 0.14))
  return Math.sin(p * Math.PI)
}

function drawPet() {
  const t = now()
  const bob = Math.sin(t * 2.1) * (state.expression === 'sleepy' ? 0.35 : 1.1)
  const hopY = hopOffset()
  const shake = shakeOffset()
  const gulp = gulpAmount()
  const ctx = $.NSGraphicsContext.currentContext
  ctx.saveGraphicsState

  const squashX = (state.pressing && !state.dragged ? 1.04 : 1) * (1 + 0.05 * gulp)
  const squashY = (state.pressing && !state.dragged ? 0.95 : 1) * (1 - 0.06 * gulp)
  const transform = $.NSAffineTransform.transform
  transform.translateXByYBy(shake, bob + hopY)
  transform.translateXByYBy(W / 2, 24)
  transform.rotateByDegrees(state.tilt * 180 / Math.PI)
  transform.scaleXByYBy(squashX, squashY)
  transform.translateXByYBy(-W / 2, -24)
  transform.concat

  const shadowScale = Math.max(0.62, 1 - hopY / 48)
  $.NSColor.blackColor.colorWithAlphaComponent(0.12 * shadowScale).setFill
  $.NSBezierPath.bezierPathWithOvalInRect($.NSMakeRect(W / 2 - 32 * shadowScale, 10, 64 * shadowScale, 10 * shadowScale)).fill

  const origin = catOrigin()
  const rect = $.NSMakeRect(origin.x, origin.y, CAT_W, CAT_H)
  const face = currentFaceImage()
  if (face) {
    face.drawInRectFromRectOperationFraction(
      rect, $.NSMakeRect(0, 0, 0, 0), $.NSCompositingOperationSourceOver, 1)
  }

  const eyesA = blinkAlpha()
  if (eyesImage && eyesA > 0.04) {
    eyesImage.drawInRectFromRectOperationFraction(
      rect, $.NSMakeRect(0, 0, 0, 0), $.NSCompositingOperationSourceOver, eyesA)
  }

  if (state.expression === 'happy' && state.hopStart) {
    const p = (t - state.hopStart) / 0.42
    if (p > 0 && p < 1) {
      blush.colorWithAlphaComponent(Math.sin(p * Math.PI) * 0.8).setFill
      const rise = p * 10
      $.NSBezierPath.bezierPathWithOvalInRect($.NSMakeRect(origin.x + 6, origin.y + 128 + rise, 5, 5)).fill
      $.NSBezierPath.bezierPathWithOvalInRect($.NSMakeRect(origin.x + 116, origin.y + 136 + rise, 4, 4)).fill
    }
  }

  ctx.restoreGraphicsState
  if (state.message) drawBubble(state.message)
}

function drawBubble(text) {
  const font = $.NSFont.systemFontOfSize(12)
  const attrs = $.NSMutableDictionary.alloc.init
  attrs.setObjectForKey(font, $.NSFontAttributeName)
  attrs.setObjectForKey(ink, $.NSForegroundColorAttributeName)
  const ns = $.NSString.alloc.initWithString(text)
  const size = ns.sizeWithAttributes(attrs)
  const w = size.width + 20
  const h = size.height + 8
  const rect = $.NSMakeRect((W - w) / 2, 176, w, h)
  const bubble = $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius(rect, h / 2, h / 2)
  const tail = $.NSBezierPath.bezierPath
  tail.moveToPoint($.NSMakePoint(W / 2 - 5, 177))
  tail.lineToPoint($.NSMakePoint(W / 2 + 5, 177))
  tail.lineToPoint($.NSMakePoint(W / 2, 170))
  tail.closePath
  const ctx = $.NSGraphicsContext.currentContext
  ctx.saveGraphicsState
  bubbleFill.setFill
  bubble.fill
  tail.fill
  ctx.restoreGraphicsState
  ns.drawAtPointWithAttributes($.NSMakePoint(rect.origin.x + 10, rect.origin.y + 3), attrs)
}

function render() {
  if (!view) return
  const image = $.NSImage.alloc.initWithSize($.NSMakeSize(W, H))
  image.lockFocus
  drawPet()
  image.unlockFocus
  view.layer.setContents(image)
}

function fileURLs(sender) {
  try {
    const urls = sender.draggingPasteboard.readObjectsForClassesOptions(
      $.NSArray.arrayWithObject($.NSURL),
      $.NSDictionary.dictionaryWithObjectForKey(true, $.NSPasteboardURLReadingFileURLsOnlyKey))
    if (!urls || urls.count === 0) return null
    return urls
  } catch (e) {
    return null
  }
}

function recycle(urls) {
  const fm = $.NSFileManager.defaultManager
  let failed = false
  for (let i = 0; i < urls.count; i++) {
    const url = urls.objectAtIndex(i)
    url.startAccessingSecurityScopedResource
    const ok = fm.trashItemAtURLResultingItemURLError(url, null, null)
    url.stopAccessingSecurityScopedResource
    if (!ok) failed = true
  }
  return !failed
}

function eat(urls) {
  wake()
  state.swallowing = true
  state.lidTarget = 1
  state.face = 'alert'
  const ok = recycle(urls)
  state.swallowing = false
  state.lidTarget = 0
  if (ok) {
    if (pref('sound', true)) $.NSSound.soundNamed('Pop').play
    state.gulpStart = now()
    state.hopStart = now()
    state.expression = 'happy'
    state.face = 'happy'
    state.expressionUntil = now() + 1.15
    say('吞掉 ' + urls.count + ' 个')
  } else {
    state.shakeStart = now()
    state.expression = 'nope'
    state.face = 'alert'
    state.expressionUntil = now() + 0.7
    say(urls.count > 1 ? '有的噎住了' : '噎住了')
  }
}

function trashCount() {
  const path = ObjC.unwrap($.NSHomeDirectory()) + '/.Trash'
  const items = $.NSFileManager.defaultManager.contentsOfDirectoryAtPathError(path, null)
  if (!items) return 0
  let count = 0
  for (let i = 0; i < items.count; i++) {
    if (ObjC.unwrap(items.objectAtIndex(i)) !== '.DS_Store') count++
  }
  return count
}

function openTrash() {
  const url = $.NSURL.fileURLWithPath(ObjC.unwrap($.NSHomeDirectory()) + '/.Trash')
  $.NSWorkspace.sharedWorkspace.openURL(url)
}

function runFinder(source) {
  const script = $.NSAppleScript.alloc.initWithSource(source)
  const result = script.executeAndReturnError(null)
  if (!result) return ''
  const text = result.stringValue
  return text ? ObjC.unwrap(text) : ''
}

function emptyTrash() {
  const count = trashCount()
  if (count === 0) { say('已经是空的'); return }
  $.NSApp.activateIgnoringOtherApps(true)
  const alert = $.NSAlert.alloc.init
  alert.setMessageText('清空废纸篓？')
  alert.setInformativeText('其中 ' + count + ' 个项目会被永久删除，无法恢复。')
  alert.setAlertStyle(2)
  alert.addButtonWithTitle('清空')
  alert.addButtonWithTitle('取消')
  alert.buttons.objectAtIndex(0).setHasDestructiveAction(true)
  if (alert.runModal !== 1000) return
  const text = runFinder(`
tell application "Finder"
    set oldWarn to warns before emptying of trash
    set warns before emptying of trash to false
    try
        empty trash
        set warns before emptying of trash to oldWarn
        return "ok"
    on error errMsg number errNum
        try
            set warns before emptying of trash to oldWarn
        end try
        return "err " & errNum
    end try
end tell`)
  if (text === 'ok') say('清空了')
  else if (text.indexOf('1743') !== -1) {
    say('请允许控制访达')
    $.NSWorkspace.sharedWorkspace.openURL($.NSURL.URLWithString('x-apple.systempreferences:com.apple.preference.security?Privacy_Automation'))
  } else say('没法清空')
}

function screenUnderMouse() {
  const mouse = $.NSEvent.mouseLocation
  const screens = $.NSScreen.screens
  for (let i = 0; i < screens.count; i++) {
    const screen = screens.objectAtIndex(i)
    const frame = screen.frame
    if (mouse.x >= frame.origin.x && mouse.x <= frame.origin.x + frame.size.width &&
        mouse.y >= frame.origin.y && mouse.y <= frame.origin.y + frame.size.height) return screen
  }
  return $.NSScreen.mainScreen
}

function save() {
  if (!panel) return
  const frame = panel.frame
  defaults().setDoubleForKey(frame.origin.x, 'originX')
  defaults().setDoubleForKey(frame.origin.y, 'originY')
}

function clamp() {
  if (!panel) return
  const frame = panel.frame
  let x = frame.origin.x
  let y = frame.origin.y
  const anchorX = x + W / 2
  const anchorY = y + 48
  const screens = $.NSScreen.screens
  let screen = null
  for (let i = 0; i < screens.count; i++) {
    const candidate = screens.objectAtIndex(i)
    const bounds = candidate.frame
    if (anchorX >= bounds.origin.x && anchorX <= bounds.origin.x + bounds.size.width &&
        anchorY >= bounds.origin.y && anchorY <= bounds.origin.y + bounds.size.height) {
      screen = candidate
      break
    }
  }
  if (!screen) screen = $.NSScreen.mainScreen
  const area = screen.visibleFrame
  x = Math.min(Math.max(x, area.origin.x + 8), area.origin.x + area.size.width - 56)
  y = Math.min(Math.max(y, area.origin.y + 8), area.origin.y + area.size.height - 56)
  panel.setFrameOrigin($.NSMakePoint(x, y))
}

function comeBack() {
  const area = screenUnderMouse().visibleFrame
  panel.setFrameOrigin($.NSMakePoint(area.origin.x + (area.size.width - W) / 2, area.origin.y + 28))
  save()
  panel.orderFrontRegardless
  wake()
  state.hopStart = now()
  state.expression = 'happy'
  state.face = 'greet'
  state.expressionUntil = now() + 1.4
  say('喵，在这儿')
}

function applyLevel() {
  panel.setLevel(pref('float', true) ? $.NSFloatingWindowLevel : $.NSNormalWindowLevel)
  if (pref('float', true)) panel.orderFrontRegardless
}

function toggleLogin() {
  const service = $.SMAppService.mainApp
  try {
    if (service.status === 1) {
      service.unregisterAndReturnError(null)
      return
    }
    service.registerAndReturnError(null)
    if (service.status === 2) say('请在登录项里允许')
    else if (service.status !== 1) say('先放到「应用程序」')
  } catch (e) {
    say('先放到「应用程序」')
  }
}

function fillMenu(menu) {
  menu.removeAllItems
  function add(title, action) {
    const item = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, action, '')
    item.setTarget(actions)
    menu.addItem(item)
    return item
  }
  add('把小猫找回来', 'comeBack:')
  add('打开废纸篓', 'openTrash:')
  add('清空废纸篓…', 'emptyTrash:')
  menu.addItem($.NSMenuItem.separatorItem)
  add('吃东西时出声', 'toggleSound:').setState(pref('sound', true) ? 1 : 0)
  add('浮在窗口上面', 'toggleFloat:').setState(pref('float', true) ? 1 : 0)
  const login = add('登录时打开', 'toggleLogin:')
  let loginOn = false
  try { loginOn = $.SMAppService.mainApp.status === 1 } catch (e) {}
  login.setState(loginOn ? 1 : 0)
  menu.addItem($.NSMenuItem.separatorItem)
  add('退出', 'quit:')
}

function popup(event) {
  const menu = $.NSMenu.alloc.init
  fillMenu(menu)
  $.NSMenu.popUpContextMenuWithEventForView(menu, event, view)
}

function bootError(error) {
  try {
    const path = '/tmp/binny-error.txt'
    let prev = ''
    if ($.NSFileManager.defaultManager.fileExistsAtPath(path)) {
      const existing = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null)
      if (existing) prev = ObjC.unwrap(existing) + '\n'
    }
    $.NSString.alloc.initWithString(prev + String(error))
      .writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null)
  } catch (e) {}
}

const actions = {}

function run() {
  try {
    const bundleID = ObjC.unwrap($.NSBundle.mainBundle.bundleIdentifier) || ''
    if (bundleID === 'io.github.renpengkai.binny') {
      const pid = $.NSProcessInfo.processInfo.processIdentifier
      const others = $.NSRunningApplication.runningApplicationsWithBundleIdentifier(bundleID)
      let duplicate = false
      for (let i = 0; i < others.count; i++) {
        if (others.objectAtIndex(i).processIdentifier !== pid) duplicate = true
      }
      if (duplicate) {
        $.NSDistributedNotificationCenter.defaultCenter.postNotificationNameObjectUserInfoDeliverImmediately(
          WAKE_NAME, 'binny', $.NSDictionary.dictionary, true)
        $.NSApp.terminate(null)
        return
      }
    }

    ObjC.registerSubclass({
      name: 'BinnyActions',
      superclass: 'NSObject',
      methods: {
        'comeBack:': { types: ['void', ['id']], implementation: function () { comeBack() } },
        'openTrash:': { types: ['void', ['id']], implementation: function () { openTrash() } },
        'emptyTrash:': { types: ['void', ['id']], implementation: function () { emptyTrash() } },
        'toggleSound:': { types: ['void', ['id']], implementation: function () { defaults().setBoolForKey(!pref('sound', true), 'sound') } },
        'toggleFloat:': { types: ['void', ['id']], implementation: function () { defaults().setBoolForKey(!pref('float', true), 'float'); applyLevel() } },
        'toggleLogin:': { types: ['void', ['id']], implementation: function () { toggleLogin() } },
        'quit:': { types: ['void', ['id']], implementation: function () { save(); $.NSApp.terminate(null) } },
        'menuWillOpen:': { types: ['void', ['id']], implementation: function (menu) { fillMenu(menu) } },
        'wake:': { types: ['void', ['id']], implementation: function () { comeBack() } },
      },
    })
    actions.obj = $.BinnyActions.alloc.init
    globalThis.binnyActions = actions.obj

    ObjC.registerSubclass({
      name: 'BinnyPetView',
      superclass: 'NSView',
      methods: {
        'acceptsFirstMouse:': { types: ['bool', ['id']], implementation: function () { return true } },
        'mouseEntered:': { types: ['void', ['id']], implementation: function () { state.hovering = true; wake() } },
        'mouseExited:': { types: ['void', ['id']], implementation: function () { state.hovering = false } },
        'mouseDown:': {
          types: ['void', ['id']],
          implementation: function () {
            const loc = $.NSEvent.mouseLocation
            state.anchor = { x: loc.x, y: loc.y }
            state.origin = { x: panel.frame.origin.x, y: panel.frame.origin.y }
            state.dragged = false
            state.pressing = true
            wake()
          },
        },
        'mouseDragged:': {
          types: ['void', ['id']],
          implementation: function () {
            const loc = $.NSEvent.mouseLocation
            const dx = loc.x - state.anchor.x
            const dy = loc.y - state.anchor.y
            if (Math.abs(dx) + Math.abs(dy) > 3) state.dragged = true
            state.tiltTarget = Math.max(-0.16, Math.min(0.16, dx * 0.0016))
            panel.setFrameOrigin($.NSMakePoint(state.origin.x + dx, state.origin.y + dy))
            $.NSCursor.closedHandCursor.set
          },
        },
        'mouseUp:': {
          types: ['void', ['id']],
          implementation: function (event) {
            state.pressing = false
            state.tiltTarget = 0
            $.NSCursor.pointingHandCursor.set
            if (state.dragged) { clamp(); save(); return }
            if (event.clickCount >= 2) openTrash()
            else pat()
          },
        },
        'rightMouseDown:': { types: ['void', ['id']], implementation: function (event) { popup(event) } },
        'draggingEntered:': {
          types: ['unsigned long long', ['id']],
          implementation: function (sender) {
            if (!fileURLs(sender)) return 0
            wake()
            state.lidTarget = 1
            return 16
          },
        },
        'draggingUpdated:': {
          types: ['unsigned long long', ['id']],
          implementation: function (sender) { return fileURLs(sender) ? 16 : 0 },
        },
        'draggingExited:': {
          types: ['void', ['id']],
          implementation: function () { if (!state.swallowing) state.lidTarget = 0 },
        },
        'prepareForDragOperation:': {
          types: ['bool', ['id']],
          implementation: function (sender) { return !!fileURLs(sender) },
        },
        'performDragOperation:': {
          types: ['bool', ['id']],
          implementation: function (sender) {
            const urls = fileURLs(sender)
            if (!urls) return false
            eat(urls)
            return true
          },
        },
      },
    })

    const app = $.NSApplication.sharedApplication
    app.setActivationPolicy($.NSApplicationActivationPolicyAccessory)

    const menu = $.NSMenu.alloc.init
    menu.setDelegate(actions.obj)
    const status = $.NSStatusBar.systemStatusBar.statusItemWithLength(-2)
    let symbol = $.NSImage.imageWithSystemSymbolNameAccessibilityDescription('cat.fill', '纸篓猫')
    if (!symbol) symbol = $.NSImage.imageWithSystemSymbolNameAccessibilityDescription('trash.fill', '纸篓猫')
    symbol.setTemplate(true)
    status.button.setImage(symbol)
    status.button.setToolTip('纸篓猫')
    status.setMenu(menu)
    globalThis.binnyStatus = status

    const mask = $.NSWindowStyleMaskBorderless | $.NSWindowStyleMaskNonactivatingPanel
    panel = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer(
      $.NSMakeRect(0, 0, W, H), mask, $.NSBackingStoreBuffered, false)
    panel.setOpaque(false)
    panel.setBackgroundColor($.NSColor.clearColor)
    panel.setHasShadow(false)
    panel.setHidesOnDeactivate(false)
    panel.setFloatingPanel(true)
    panel.setBecomesKeyOnlyIfNeeded(true)
    panel.setMovable(false)
    panel.setRestorable(false)
    panel.setAnimationBehavior(0)
    panel.setExcludedFromWindowsMenu(true)
    panel.setCollectionBehavior(1 | 16 | 64)
    applyLevel()

    view = $.BinnyPetView.alloc.initWithFrame($.NSMakeRect(0, 0, W, H))
    view.setWantsLayer(true)
    view.layer.setOpaque(false)
    view.registerForDraggedTypes(['public.file-url'])
    // entered/exited | cursor update | active always | in visible rect
    const tracking = $.NSTrackingArea.alloc.initWithRectOptionsOwnerUserInfo(
      $.NSMakeRect(0, 0, W, H), 0x01 | 0x04 | 0x80 | 0x200, view, null)
    view.addTrackingArea(tracking)
    panel.setContentView(view)

    if (defaults().objectForKey('originX')) {
      panel.setFrameOrigin($.NSMakePoint(defaults().doubleForKey('originX'), defaults().doubleForKey('originY')))
    } else {
      const area = $.NSScreen.mainScreen.visibleFrame
      panel.setFrameOrigin($.NSMakePoint(area.origin.x + area.size.width - W - 28, area.origin.y + 24))
    }
    clamp()
    panel.orderFrontRegardless

    const t = now()
    state.lastInteraction = t
    state.nextBlink = t + 1.2
    state.nextGlance = t + 1.4
    if (!defaults().boolForKey('didGreet')) {
      defaults().setBoolForKey(true, 'didGreet')
      state.face = 'greet'
      state.expression = 'happy'
      state.expressionUntil = now() + 2.2
      say('喵，把文件扔给我')
    }
    loadFaces()

    let lastClamp = 0
    const timer = $.NSTimer.timerWithTimeIntervalRepeatsBlock(1 / 24, true, function () {
      try {
        step()
        render()
        if (!state.pressing && now() - lastClamp > 3) {
          lastClamp = now()
          clamp()
        }
      } catch (error) {
        bootError(String(error))
      }
    })
    $.NSRunLoop.mainRunLoop.addTimerForMode(timer, $.NSRunLoopCommonModes)
    globalThis.binnyTimer = timer

    try {
      $.NSDistributedNotificationCenter.defaultCenter.addObserverSelectorNameObject(
        actions.obj, 'wake:', WAKE_NAME, 'binny')
    } catch (error) { bootError('dist ' + error) }

    try {
      const appMenu = $.NSMenu.alloc.init
      const quit = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent('退出纸篓猫', 'terminate:', 'q')
      quit.setTarget(app)
      appMenu.addItem(quit)
      const root = $.NSMenuItem.alloc.init
      root.setSubmenu(appMenu)
      const main = $.NSMenu.alloc.init
      main.addItem(root)
      app.setMainMenu(main)
    } catch (error) { bootError('menu ' + error) }
  } catch (error) {
    bootError(error)
  }
}

function idle() { return 3600 }
