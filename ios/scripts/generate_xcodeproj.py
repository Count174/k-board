#!/usr/bin/env python3
"""
Генерирует Oubaitori.xcodeproj без XcodeGen.
Запуск: python3 ios/scripts/generate_xcodeproj.py
"""
from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "Oubaitori"
APP_DIR = ROOT / "Oubaitori"
XCODEPROJ = ROOT / "Oubaitori.xcodeproj"
PBXPROJ = XCODEPROJ / "project.pbxproj"
SCHEME_DIR = XCODEPROJ / "xcshareddata" / "xcschemes"
SCHEME_FILE = SCHEME_DIR / "Oubaitori.xcscheme"

PRODUCT_NAME = "Oubaitori"
BUNDLE_ID = "ru.oubaitori.app"
DEPLOYMENT_TARGET = "17.0"
SWIFT_VERSION = "5.9"


def uid(seed: str) -> str:
    return hashlib.md5(f"oubaitori:{seed}".encode()).hexdigest()[:24].upper()


def collect_swift_files() -> list[Path]:
    return sorted(p.relative_to(APP_DIR) for p in APP_DIR.rglob("*.swift"))


class GroupNode:
    def __init__(self, name: str, path: str | None = None):
        self.name = name
        self.path = path or name
        self.children_dirs: dict[str, GroupNode] = {}
        self.files: list[Path] = []

    def add_file(self, rel: Path) -> None:
        parts = rel.parts
        if len(parts) == 1:
            self.files.append(rel)
            return
        node = self
        for part in parts[:-1]:
            if part not in node.children_dirs:
                node.children_dirs[part] = GroupNode(part)
            node = node.children_dirs[part]
        node.files.append(Path(parts[-1]))


def main() -> None:
    swift_files = collect_swift_files()
    if not swift_files:
        raise SystemExit(f"No Swift files in {APP_DIR}")

    root = GroupNode("Oubaitori", "Oubaitori")
    for sf in swift_files:
        root.add_file(sf)

    ids = {k: uid(k) for k in [
        "project", "main_group", "products_group", "root_group",
        "target", "sources_phase", "resources_phase", "frameworks_phase",
        "product_ref", "project_config_list", "target_config_list",
        "debug_project", "release_project", "debug_target", "release_target",
        "assets_ref", "assets_build", "plist_ref",
    ]}

    file_refs: dict[str, str] = {}
    build_files: dict[str, str] = {}
    for sf in swift_files:
        key = sf.as_posix()
        file_refs[key] = uid(f"ref:{key}")
        build_files[key] = uid(f"build:{key}")

    group_ids: dict[int, str] = {}

    def register_groups(node: GroupNode) -> str:
        gid = uid(f"group:{node.path}")
        group_ids[id(node)] = gid
        for child in node.children_dirs.values():
            register_groups(child)
        return gid

    register_groups(root)

    lines: list[str] = []
    a = lines.append

    a("// !$*UTF8*$!")
    a("{")
    a("\tarchiveVersion = 1;")
    a("\tclasses = {};")
    a("\tobjectVersion = 56;")
    a("\tobjects = {")

    a("\n/* Begin PBXBuildFile section */")
    for sf in swift_files:
        k = sf.as_posix()
        a(f"\t\t{build_files[k]} /* {sf.name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[k]} /* {sf.name} */; }};")
    a(f"\t\t{ids['assets_build']} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {ids['assets_ref']} /* Assets.xcassets */; }};")
    a("/* End PBXBuildFile section */\n")

    a("/* Begin PBXFileReference section */")
    a(f"\t\t{ids['product_ref']} /* {PRODUCT_NAME}.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {PRODUCT_NAME}.app; sourceTree = BUILT_PRODUCTS_DIR; }};")
    for sf in swift_files:
        k = sf.as_posix()
        a(f"\t\t{file_refs[k]} /* {sf.name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {sf.name}; sourceTree = \"<group>\"; }};")
    a(f"\t\t{ids['assets_ref']} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};")
    a(f"\t\t{ids['plist_ref']} /* Info.plist */ = {{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = \"<group>\"; }};")
    a("/* End PBXFileReference section */\n")

    a("/* Begin PBXFrameworksBuildPhase section */")
    a(f"\t\t{ids['frameworks_phase']} /* Frameworks */ = {{")
    a("\t\t\tisa = PBXFrameworksBuildPhase;")
    a("\t\t\tbuildActionMask = 2147483647;")
    a("\t\t\tfiles = ();")
    a("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    a("\t\t};")
    a("/* End PBXFrameworksBuildPhase section */\n")

    def group_children(node: GroupNode, prefix: Path) -> list[str]:
        result: list[str] = []
        for name in sorted(node.children_dirs):
            result.append(group_ids[id(node.children_dirs[name])])
        for sf in swift_files:
            if sf.parent == prefix:
                result.append(file_refs[sf.as_posix()])
        return result

    a("/* Begin PBXGroup section */")
    a(f"\t\t{ids['main_group']} = {{")
    a("\t\t\tisa = PBXGroup;")
    a(f"\t\t\tchildren = ({group_ids[id(root)]} /* Oubaitori */, {ids['products_group']} /* Products */,);")
    a('\t\t\tsourceTree = "<group>";')
    a("\t\t};")
    a(f"\t\t{ids['products_group']} /* Products */ = {{")
    a("\t\t\tisa = PBXGroup;")
    a(f"\t\t\tchildren = ({ids['product_ref']} /* {PRODUCT_NAME}.app */,);")
    a("\t\t\tname = Products;")
    a('\t\t\tsourceTree = "<group>";')
    a("\t\t};")

    def walk_emit(node: GroupNode, rel: Path) -> None:
        gid = group_ids[id(node)]
        kids = group_children(node, rel)
        if node.path == "Oubaitori":
            kids = kids + [ids["plist_ref"], ids["assets_ref"]]
        a(f"\t\t{gid} = {{")
        a("\t\t\tisa = PBXGroup;")
        a(f"\t\t\tchildren = ({', '.join(kids)},);")
        a(f"\t\t\tname = {node.name};")
        a(f"\t\t\tpath = {node.path};")
        a('\t\t\tsourceTree = "<group>";')
        a("\t\t};")
        for name in sorted(node.children_dirs):
            child = node.children_dirs[name]
            walk_emit(child, rel / name)

    walk_emit(root, Path("."))
    a("/* End PBXGroup section */\n")

    a("/* Begin PBXNativeTarget section */")
    a(f"\t\t{ids['target']} /* {PRODUCT_NAME} */ = {{")
    a("\t\t\tisa = PBXNativeTarget;")
    a(f"\t\t\tbuildConfigurationList = {ids['target_config_list']};")
    a(f"\t\t\tbuildPhases = ({ids['sources_phase']} /* Sources */, {ids['frameworks_phase']} /* Frameworks */, {ids['resources_phase']} /* Resources */);")
    a("\t\t\tbuildRules = ();")
    a("\t\t\tdependencies = ();")
    a(f"\t\t\tname = {PRODUCT_NAME};")
    a(f"\t\t\tproductName = {PRODUCT_NAME};")
    a(f"\t\t\tproductReference = {ids['product_ref']} /* {PRODUCT_NAME}.app */;")
    a('\t\t\tproductType = "com.apple.product-type.application";')
    a("\t\t};")
    a("/* End PBXNativeTarget section */\n")

    a("/* Begin PBXProject section */")
    a(f"\t\t{ids['project']} /* Project object */ = {{")
    a("\t\t\tisa = PBXProject;")
    a("\t\t\tattributes = {")
    a("\t\t\t\tBuildIndependentTargetsInParallel = 1;")
    a("\t\t\t\tLastSwiftUpdateCheck = 1500;")
    a("\t\t\t\tLastUpgradeCheck = 1500;")
    a("\t\t\t\tTargetAttributes = {")
    a(f"\t\t\t\t\t{ids['target']} = {{")
    a("\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;")
    a("\t\t\t\t\t};")
    a("\t\t\t\t};")
    a("\t\t\t};")
    a(f"\t\t\tbuildConfigurationList = {ids['project_config_list']};")
    a('\t\t\tcompatibilityVersion = "Xcode 14.0";')
    a("\t\t\tdevelopmentRegion = ru;")
    a("\t\t\tknownRegions = (")
    a("\t\t\t\ten,")
    a("\t\t\t\tBase,")
    a("\t\t\t\tru,")
    a("\t\t\t);")
    a(f"\t\t\tmainGroup = {ids['main_group']};")
    a(f"\t\t\tproductRefGroup = {ids['products_group']} /* Products */;")
    a('\t\t\tprojectDirPath = "";')
    a('\t\t\tprojectRoot = "";')
    a(f"\t\t\ttargets = ({ids['target']} /* {PRODUCT_NAME} */,);")
    a("\t\t};")
    a("/* End PBXProject section */\n")

    a("/* Begin PBXResourcesBuildPhase section */")
    a(f"\t\t{ids['resources_phase']} /* Resources */ = {{")
    a("\t\t\tisa = PBXResourcesBuildPhase;")
    a("\t\t\tbuildActionMask = 2147483647;")
    a(f"\t\t\tfiles = ({ids['assets_build']} /* Assets.xcassets in Resources */,);")
    a("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    a("\t\t};")
    a("/* End PBXResourcesBuildPhase section */\n")

    a("/* Begin PBXSourcesBuildPhase section */")
    src = ", ".join(f"{build_files[sf.as_posix()]} /* {sf.name} in Sources */" for sf in swift_files)
    a(f"\t\t{ids['sources_phase']} /* Sources */ = {{")
    a("\t\t\tisa = PBXSourcesBuildPhase;")
    a("\t\t\tbuildActionMask = 2147483647;")
    a(f"\t\t\tfiles = ({src},);")
    a("\t\t\trunOnlyForDeploymentPostprocessing = 0;")
    a("\t\t};")
    a("/* End PBXSourcesBuildPhase section */\n")

    target_settings = f"""				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = Oubaitori/Info.plist;
				INFOPLIST_KEY_CFBundleDisplayName = Oubaitori;
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				IPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 0.1.0;
				PRODUCT_BUNDLE_IDENTIFIER = {BUNDLE_ID};
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = {SWIFT_VERSION};
				TARGETED_DEVICE_FAMILY = 1;"""

    a("/* Begin XCBuildConfiguration section */")
    a(f"\t\t{ids['debug_project']} /* Debug */ = {{")
    a("\t\t\tisa = XCBuildConfiguration;")
    a("\t\t\tbuildSettings = {")
    a("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    a("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    a("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    a("\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;")
    a("\t\t\t\tENABLE_TESTABILITY = YES;")
    a("\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;")
    a(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
    a("\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;")
    a("\t\t\t\tONLY_ACTIVE_ARCH = YES;")
    a("\t\t\t\tSDKROOT = iphoneos;")
    a('\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";')
    a("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-Onone\";")
    a("\t\t\t};")
    a("\t\t\tname = Debug;")
    a("\t\t};")
    a(f"\t\t{ids['release_project']} /* Release */ = {{")
    a("\t\t\tisa = XCBuildConfiguration;")
    a("\t\t\tbuildSettings = {")
    a("\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;")
    a("\t\t\t\tCLANG_ENABLE_MODULES = YES;")
    a("\t\t\t\tCOPY_PHASE_STRIP = NO;")
    a("\t\t\t\tDEBUG_INFORMATION_FORMAT = \"dwarf-with-dsym\";")
    a("\t\t\t\tENABLE_TESTABILITY = NO;")
    a("\t\t\t\tGCC_OPTIMIZATION_LEVEL = s;")
    a(f"\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = {DEPLOYMENT_TARGET};")
    a("\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;")
    a("\t\t\t\tONLY_ACTIVE_ARCH = NO;")
    a("\t\t\t\tSDKROOT = iphoneos;")
    a("\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = \"-O\";")
    a("\t\t\t};")
    a("\t\t\tname = Release;")
    a("\t\t};")
    for name, cid in [("Debug", ids["debug_target"]), ("Release", ids["release_target"])]:
        a(f"\t\t{cid} /* {name} */ = {{")
        a("\t\t\tisa = XCBuildConfiguration;")
        a("\t\t\tbuildSettings = {")
        a(target_settings)
        a("\t\t\t};")
        a(f"\t\t\tname = {name};")
        a("\t\t};")
    a("/* End XCBuildConfiguration section */\n")

    a("/* Begin XCConfigurationList section */")
    a(f"\t\t{ids['project_config_list']} = {{")
    a("\t\t\tisa = XCConfigurationList;")
    a(f"\t\t\tbuildConfigurations = ({ids['debug_project']} /* Debug */, {ids['release_project']} /* Release */);")
    a("\t\t\tdefaultConfigurationIsVisible = 0;")
    a("\t\t\tdefaultConfigurationName = Release;")
    a("\t\t};")
    a(f"\t\t{ids['target_config_list']} = {{")
    a("\t\t\tisa = XCConfigurationList;")
    a(f"\t\t\tbuildConfigurations = ({ids['debug_target']} /* Debug */, {ids['release_target']} /* Release */);")
    a("\t\t\tdefaultConfigurationIsVisible = 0;")
    a("\t\t\tdefaultConfigurationName = Release;")
    a("\t\t};")
    a("/* End XCConfigurationList section */")

    a("\t};")
    a(f"\trootObject = {ids['project']} /* Project object */;")
    a("}")

    XCODEPROJ.mkdir(parents=True, exist_ok=True)
    PBXPROJ.write_text("\n".join(lines) + "\n", encoding="utf-8")

    workspace = XCODEPROJ / "project.xcworkspace"
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "contents.xcworkspacedata").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Workspace version=\"1.0\">\n"
        "   <FileRef location=\"self:\"></FileRef>\n"
        "</Workspace>\n",
        encoding="utf-8",
    )

    SCHEME_DIR.mkdir(parents=True, exist_ok=True)
    SCHEME_FILE.write_text(
        f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion="1500"
   version="1.7">
   <BuildAction
      parallelizeBuildables="YES"
      buildImplicitDependencies="YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting="YES"
            buildForRunning="YES"
            buildForProfiling="YES"
            buildForArchiving="YES"
            buildForAnalyzing="YES">
            <BuildableReference
               BuildableIdentifier="primary"
               BlueprintIdentifier="{ids['target']}"
               BuildableName="{PRODUCT_NAME}.app"
               BlueprintName="{PRODUCT_NAME}"
               ReferencedContainer="container:Oubaitori.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration="Debug"
      selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv="YES"
      shouldAutocreateTestPlan="YES">
   </TestAction>
   <LaunchAction
      buildConfiguration="Debug"
      selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle="0"
      useCustomWorkingDirectory="NO"
      ignoresPersistentStateOnLaunch="NO"
      debugDocumentVersioning="YES"
      debugServiceExtension="internal"
      allowLocationSimulation="YES">
      <BuildableProductRunnable
         runnableDebuggingMode="0">
         <BuildableReference
            BuildableIdentifier="primary"
            BlueprintIdentifier="{ids['target']}"
            BuildableName="{PRODUCT_NAME}.app"
            BlueprintName="{PRODUCT_NAME}"
            ReferencedContainer="container:Oubaitori.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration="Release"
      shouldUseLaunchSchemeArgsEnv="YES"
      savedToolIdentifier=""
      useCustomWorkingDirectory="NO"
      debugDocumentVersioning="YES">
      <BuildableProductRunnable
         runnableDebuggingMode="0">
         <BuildableReference
            BuildableIdentifier="primary"
            BlueprintIdentifier="{ids['target']}"
            BuildableName="{PRODUCT_NAME}.app"
            BlueprintName="{PRODUCT_NAME}"
            ReferencedContainer="container:Oubaitori.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration="Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration="Release"
      revealArchiveInOrganizer="YES">
   </ArchiveAction>
</Scheme>
""",
        encoding="utf-8",
    )

    print(f"✅ Created {PBXPROJ}")
    print(f"   Swift files: {len(swift_files)}")
    print(f"   open {XCODEPROJ}")


if __name__ == "__main__":
    main()
