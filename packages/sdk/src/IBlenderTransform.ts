/**
 * Optional local-space transform components; Euler angles are XYZ radians and each supplied component is finite within absolute 1e20.
 *
 * Supply at least one vector. Omitted components preserve their existing values; these are local properties rather than evaluated world transforms.
 */
export interface IBlenderTransform {
  /** Local translation in the scene's Blender units. */
  location?: [number, number, number];

  /** Local XYZ Euler angles in radians; changes rotation mode to XYZ. */
  rotationEuler?: [number, number, number];

  /** Local scale factors; zero and negative components are permitted. */
  scale?: [number, number, number];
}
