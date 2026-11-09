#!/usr/bin/env python3
"""Tạo phím tắt iOS K.Clip (WFWorkflow plist) và ký qua HubSign (RoutineHub).

iOS 15+ chỉ nhập file .shortcut đã ký (định dạng AEA1). Chạy:
  python3 tools/build_shortcut.py
Kết quả: K.Clip.unsigned.plist (nguồn XML) và K.Clip.shortcut (đã ký).
"""
import json, plistlib, sys, urllib.request, pathlib

BASE = "https://yosimura99.github.io/k-clip/?url="
ROOT = pathlib.Path(__file__).resolve().parent.parent
ENC_UUID = "6F1C2A10-4B7E-4C21-9E0A-1A2B3C4D5E01"
TXT_UUID = "6F1C2A10-4B7E-4C21-9E0A-1A2B3C4D5E02"

def utf16len(s):
    return len(s.encode("utf-16-le")) // 2

text = BASE + "\ufffc"
workflow = {
    "WFWorkflowClientVersion": "4033.0.4.3",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 1440408063,  # light blue
                       "WFWorkflowIconGlyphNumber": 59693},      # downloadArrow
    "WFWorkflowTypes": ["ActionExtension"],
    "WFQuickActionSurfaces": [],
    "WFWorkflowInputContentItemClasses": ["WFURLContentItem", "WFStringContentItem"],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowHasShortcutInputVariables": True,
    "WFWorkflowHasOutputFallback": False,
    "WFWorkflowImportQuestions": [],
    "WFWorkflowActions": [
        {"WFWorkflowActionIdentifier": "is.workflow.actions.urlencode",
         "WFWorkflowActionParameters": {
             "UUID": ENC_UUID,
             "WFEncodeMode": "Encode",
             "WFInput": {"WFSerializationType": "WFTextTokenString",
                         "Value": {"string": "\ufffc",
                                   "attachmentsByRange": {"{0, 1}": {"Type": "ExtensionInput"}}}}}},
        {"WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
         "WFWorkflowActionParameters": {
             "UUID": TXT_UUID,
             "WFTextActionText": {"WFSerializationType": "WFTextTokenString",
                                  "Value": {"string": text,
                                            "attachmentsByRange": {
                                                "{%d, 1}" % utf16len(BASE): {
                                                    "Type": "ActionOutput",
                                                    "OutputUUID": ENC_UUID,
                                                    "OutputName": "URL Encoded Text"}}}}}},
        {"WFWorkflowActionIdentifier": "is.workflow.actions.openurl",
         "WFWorkflowActionParameters": {
             "WFInput": {"WFSerializationType": "WFTextTokenAttachment",
                         "Value": {"Type": "ActionOutput", "OutputUUID": TXT_UUID,
                                   "OutputName": "Text"}}}},
    ],
}

xml = plistlib.dumps(workflow, fmt=plistlib.FMT_XML)
(ROOT / "K.Clip.unsigned.plist").write_bytes(xml)

req = urllib.request.Request(
    "https://hubsign.routinehub.services/sign",
    data=json.dumps({"shortcutName": "K.Clip", "shortcut": xml.decode()}).encode(),
    headers={"Content-Type": "application/json", "User-Agent": "cherri/2.0",
             "Origin": "https://routinehub.co"}, method="POST")
with urllib.request.urlopen(req, timeout=60) as r:
    body = r.read()
if body[:4] != b"AEA1":
    sys.exit("HubSign không trả về file đã ký: %r" % body[:200])
(ROOT / "K.Clip.shortcut").write_bytes(body)
print("OK", len(body), "bytes")
