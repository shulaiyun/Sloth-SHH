import { buffer } from '@kit.ArkTS';
import asset from '@ohos.security.asset';

export class SecureStore {
  private alias(id: string): Uint8Array {
    return buffer.from(`slothssh.password.${id}`, 'utf8');
  }

  async savePassword(id: string, password: string): Promise<void> {
    const attributes: asset.AssetMap = new Map();
    attributes.set(asset.Tag.ALIAS, this.alias(id));
    attributes.set(asset.Tag.SECRET, buffer.from(password, 'utf8'));
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_FIRST_UNLOCKED);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    await asset.add(attributes);
  }

  async password(id: string): Promise<string> {
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, this.alias(id));
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    try {
      const result: Array<asset.AssetMap> = await asset.query(query);
      if (result.length === 0) {
        return '';
      }
      const secret: Uint8Array = result[0].get(asset.Tag.SECRET) as Uint8Array;
      return buffer.from(secret).toString('utf8');
    } catch (_error) {
      return '';
    }
  }

  async removePassword(id: string): Promise<void> {
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, this.alias(id));
    try {
      await asset.remove(query);
    } catch (_error) {
      // Missing entries are already in the desired state.
    }
  }
}
