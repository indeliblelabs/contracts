export const hashToSVG = () => `
function hashToSVG(string memory _hash)
    public
    view
    returns (string memory)
{
    bytes memory svgBytes = DynamicBuffer.allocate(1024 * 128);
    svgBytes.appendSafe('<svg width="1200" height="1200" viewBox="0 0 1200 1200" version="1.2" xmlns="http://www.w3.org/2000/svg" style="background-color:');
    svgBytes.appendSafe(
        abi.encodePacked(
            backgroundColor,
            ";background-image:url("
        )
    );

    uint variant = HelperLib.parseInt(
        HelperLib._substring(_hash, 0, 3)
    );

    for (uint i = 0; i < NUM_LAYERS; i++) {
        uint traitIndex = HelperLib.parseInt(
            HelperLib._substring(_hash, ((i + 1) * 3), ((i + 1) * 3) + 3)
        );
        uint traitVariant = _traitDetails[i][traitIndex].length > variant ? variant : 0;
        if (i == NUM_LAYERS - 1) {
            svgBytes.appendSafe(
                abi.encodePacked(
                    "data:",
                    _traitDetails[i][traitIndex].mimetype,
                    ";base64,",
                    Base64.encode(SSTORE2.read(_traitDataPointers[i][traitIndex][traitVariant])),
                    ');background-repeat:no-repeat;background-size:contain;background-position:center;image-rendering:-webkit-optimize-contrast;-ms-interpolation-mode:nearest-neighbor;image-rendering:-moz-crisp-edges;image-rendering:pixelated;"></svg>'
                )
            );
        } else {
            svgBytes.appendSafe(
                abi.encodePacked(
                    "data:",
                    _traitDetails[i][traitIndex][traitVariant].mimetype,
                    ";base64,",
                    Base64.encode(SSTORE2.read(_traitDataPointers[i][traitIndex][traitVariant])),
                    "),url("
                )
            );
        }
    }

    return string(
        abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(svgBytes)
        )
    );
}
`;
