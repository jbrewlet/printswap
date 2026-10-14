/** Bed-swap G-code block (byte-for-byte match with Printflow 0.1.0). */
export const SWAP_GCODE_BLOCK =
	'\n  M17 X1.2 Y1.2 Z0.75 ; START\nG28 X Y\nG1 Y264 F9000 ; move the bed all the way forward\nG1 Z235 F1000 \nG1 Y160 F2000\nG1 Y210 F2000\nG1 Y80 F2000\nG1 Y140 F2000\nG1 Y20 F2000 ; move the bed 250mm backward\nG1 Y150 F6000 ; move the bed 150mm Forward\nG1 Y-1 F10000 ; move the bed backward and grab a new plate\nG1 Z190 F1000\nG28 Y\nG1 Y250 F3000 ; move the bed with the new plate\nG1 Y265.5 F1500 ; move the bed with the new plate\nG1 Y30 F3000; \nG1 Y-1.8 F500; \nG1 Y8.5 F100; \nM17 X0.8 Y0.8 Z0.5 ; lower motor current to 45% power\nG1 Y-2 F4500; \nM17 X1.2 Y1.2 Z0.75; motor current to 100% power\nG1 Z150 F1500 \nG1 Y50 F1000; END\n  ';

export const M620_SEARCH = '\nM620 S';

export const MODEL_SETTINGS_SWAP = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="SWAP"/>
    <metadata key="locked" value="false"/>
    <metadata key="gcode_file" value="Metadata/plate_1.gcode"/>
    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>
    <metadata key="top_file" value="Metadata/top_1.png"/>
    <metadata key="pick_file" value="Metadata/pick_1.png"/>
    <metadata key="pattern_bbox_file" value="Metadata/plate_1.json"/>
  </plate>
</config> `;
