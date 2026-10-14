import JSZip from 'jszip';

const MODEL_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="test"/>
    <metadata key="gcode_file" value="Metadata/plate_1.gcode"/>
    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>
  </plate>
</config>`;

const SLICE_INFO = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <filament id="1" type="PETG" color="#FF8000" used_m="10.5" used_g="32.1"/>
  </plate>
</config>`;

const PROJECT_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?><config><filament id="1"/></config>`;

export function sampleGcodeWithAms(): string {
	return (
		'; thumbnail begin\n' +
		'total estimated time: 2h 5m 10s\n' +
		'\nM620 S1\n\nM620 S255\n\nM620 S1\n\n' +
		'; end'
	);
}

export async function buildSynthetic3mf(options?: {
	gcode?: string;
	includeExtraPlateGcode?: boolean;
}): Promise<Blob> {
	const gcode = options?.gcode ?? sampleGcodeWithAms();
	const zip = new JSZip();
	zip.file('Metadata/model_settings.config', MODEL_SETTINGS);
	zip.file('Metadata/slice_info.config', SLICE_INFO);
	zip.file('Metadata/project_settings.config', PROJECT_SETTINGS);
	zip.file('Metadata/plate_1.gcode', gcode);
	zip.file('Metadata/plate_1.png', new Uint8Array([137, 80, 78, 71]));
	zip.file('Metadata/custom_gcode_per_layer.xml', '<config/>');
	if (options?.includeExtraPlateGcode) {
		zip.file('Metadata/plate_2.gcode', '; plate 2');
		zip.file('Metadata/plate_2.gcode.md5', 'abc');
	}
	return zip.generateAsync({ type: 'blob' });
}

export async function buildSyntheticFile(name = 'part.gcode.3mf'): Promise<File> {
	const blob = await buildSynthetic3mf({ includeExtraPlateGcode: true });
	return new File([blob], name, { type: 'application/zip' });
}
