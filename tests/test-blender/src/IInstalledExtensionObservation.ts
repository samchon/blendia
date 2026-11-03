/** Native observations from an actually enabled extension installed through Blender's ZIP command. */
export interface IInstalledExtensionObservation {
  /** Canonical bl_ext repository/package import name observed by the installed addon. */
  moduleName: string;

  /** Actual resolved __file__ of that imported installed addon. */
  moduleFile: string;

  /** Resolved installed package directory subsequently supplied to every headless invocation. */
  extensionDirectory: string;

  /** SHA256 of the official build ZIP whose payload was compared with installed files. */
  archiveSha256: string;

  /** Number of actual ZIP payload files individually matched to the installed bytes. */
  payloadFiles: number;

  /** SHA256 of the installed license after matching the maintained root LICENSE. */
  licenseSha256: string;

  /** Native addon enablement, operator registration and disable/enable lifecycle all succeeded. */
  registrationVerified: boolean;
}
