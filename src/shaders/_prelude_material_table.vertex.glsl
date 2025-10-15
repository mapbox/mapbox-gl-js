#ifdef HAS_SHADER_STORAGE_BLOCK_material_buffer

#define MATERIAL_TABLE_DEBUG 0

uniform int u_material_offset;
uniform int u_vertex_offset;
layout(std140, binding = 0)readonly buffer material_buffer{
    uvec4 material_data[];
};

///////////// Copy to CPU start ////////////////////


struct MaterialInfo{
    uint dataOffset;
#if MATERIAL_TABLE_DEBUG
    vec4 colorDebug;
#endif
};

uint read_buf_no_offset(uint iDword) {
    return material_data[iDword / 4u][iDword % 4u];
}
uint read_buf(uint iDword) {
    iDword += uint(u_material_offset / 4);
    return read_buf_no_offset(iDword);
}

float read_buf_float(uint iDword){
    return uintBitsToFloat(read_buf(iDword));
}

uint read_buf_uint8(uint iDword, uint iUint8){
    uint dwordOffset = iDword + (iUint8 / 4u);
    uint byteOffset = iUint8 & 3u;
    uint bitOffset = 8u * byteOffset;
    uint mask = 0xffu << bitOffset;
    uint dwordVal = read_buf(dwordOffset);
    return (dwordVal & mask) >> bitOffset;
}

uint read_buf_uint16(uint iDword, uint iUint16){
    uint dwordOffset = iDword + (iUint16 >> 1u);
    uint bitOffset = (iUint16 & 1u) * 16u;
    uint mask = 0xffffu << bitOffset;
    uint dwordVal = read_buf(dwordOffset);
    return (dwordVal & mask) >> bitOffset;
}
uint nrDwordsForVertexIdEntries(uint nrMaterialLookupEntries) {
    return nrMaterialLookupEntries;
}

uint nrDwordsForMaterialIdEntries(uint nrMaterialLookupEntries) {
    return (nrMaterialLookupEntries * 2u + 3u) / 4u;
}

uint findRangeBinarySearch(uint vertexId, uint numRanges, uint dwordOffset) {
    uint left = 0u;
    uint right = numRanges - 1u;

    for (uint i = 0u; i < 16u; i++) { 
        if (left > right) {
            break;
        }

        uint mid = (left + right) / 2u;
        uint start = read_buf(dwordOffset + mid);
        uint nextStart = (mid + 1u < numRanges) ? read_buf(dwordOffset + mid + 1u) : 0xffffffffu; // UINT_MAX

        if (vertexId >= start && vertexId < nextStart) {
            return mid;
        } else if (vertexId < start) {
            if (mid == 0u) {
                break;
            }
            right = mid - 1u;
        } else {
            left = mid + 1u;
        }
    }

    return 0u; 
}

uint readVertexId(uint dwordOffset, uint iMaterialLookupEntry) {
    return read_buf(dwordOffset + iMaterialLookupEntry);
}

uint findRange(uint vertexId, uint numRanges, uint dwordOffset) {
    uint iRange;
    // linear search for less elements, binary search for bigger
    if(numRanges <= 64u){
        uint vertexBegin;
        for(iRange = 0u; iRange < numRanges; ++iRange) {
            vertexBegin = readVertexId(dwordOffset, iRange);
            if(vertexBegin > vertexId) {
                break;
            }
        }
        iRange = iRange == 0u? 0u : iRange - 1u;
    } else { 
        iRange = findRangeBinarySearch(vertexId, numRanges, dwordOffset);
    }
    return iRange;
}

MaterialInfo read_material_info(uint vertex_id) {
    MaterialInfo info;
#if MATERIAL_TABLE_DEBUG
    const vec4 red = vec4(1.0, 0.0, 0.0, 1.0);
    const vec4 orange = vec4(1.0, 0.5, 0.0, 1.0);
    const vec4 yellow = vec4(1.0, 1.0, 0.0, 1.0);
    const vec4 green = vec4(0.0, 1.0, 0.0, 1.0);
    const vec4 indigo = vec4(0.294, 0.0, 0.510, 1.0);
    const vec4 blue = vec4(0.0, 0.0, 1.0, 1.0);
    const vec4 purple = vec4(0.5, 0.0, 0.5, 1.0);
    const vec4 pink = vec4(1.0, 0.0, 1.0, 1.0);
    info.colorDebug = green;
#endif

    uint offset = 0u;
#if MATERIAL_TABLE_DEBUG
    bool keepFinding = true;
    uint magic = read_buf(offset);
    if(magic != 0xCAFEBABEu) {
        info.colorDebug = red;
        keepFinding = false;
        //do not even continue
        return info;
    }
#endif
    offset++;

#if MATERIAL_TABLE_DEBUG
    uint nrMaterials = read_buf(offset);
    uint nrVertices = read_buf(offset + 1u);
    if(keepFinding && vertex_id >= nrVertices) {
        info.colorDebug = red;
        keepFinding = false;
    }
#endif
    offset += 2u;
    uint nrMaterialLookupEntries = read_buf(offset++);
    uint perMaterialEntrySizeDwords = read_buf(offset++);
#if MATERIAL_TABLE_DEBUG
    if(keepFinding && perMaterialEntrySizeDwords != 1u) {
        info.colorDebug = red;
        keepFinding = false;
    }
#endif

    uint iMaterialLookup = findRange(vertex_id, nrMaterialLookupEntries, offset);
#if MATERIAL_TABLE_DEBUG
    if(keepFinding)
    {
        uint vertexBeginCheck = readVertexId(offset, iMaterialLookup);
        if(vertexBeginCheck > vertex_id) {
            info.colorDebug = red;
            keepFinding = false;
        }
        if(iMaterialLookup < nrMaterialLookupEntries - 1u) {
            uint vertexEndCheck = readVertexId(offset, iMaterialLookup + 1u);
            if(vertexEndCheck <= vertex_id) {
                info.colorDebug = red;
                keepFinding = false;
            }
        }
    }
#endif

    offset += nrDwordsForVertexIdEntries(nrMaterialLookupEntries);
    uint materialId = iMaterialLookup;
    
#if MATERIAL_TABLE_DEBUG
    if(keepFinding) {
        if(materialId >= nrMaterialLookupEntries) {
            info.colorDebug = red;
        }
    }
#endif
    info.dataOffset = offset + materialId * perMaterialEntrySizeDwords;
    return info;
}

uint get_data_location(const MaterialInfo matInfo, uint attribOffsetBytes)
{
    uint attribFieldOffsetDwords = attribOffsetBytes / 4u;
    return matInfo.dataOffset + attribFieldOffsetDwords;
}

vec4 read_material_vec4(const MaterialInfo matInfo, uint attribOffsetBytes){
    uint loc = get_data_location(matInfo, attribOffsetBytes);
    return vec4(read_buf_float(loc), read_buf_float(loc+1u), read_buf_float(loc+2u), read_buf_float(loc+3u));
}

vec2 read_material_vec2(const MaterialInfo matInfo, uint attribOffsetBytes){
    uint loc = get_data_location(matInfo, attribOffsetBytes);
    return vec2(read_buf_float(loc), read_buf_float(loc+1u));
}

float read_material_float(const MaterialInfo matInfo, uint attribOffsetBytes){
    uint loc = get_data_location(matInfo, attribOffsetBytes);
    return read_buf_float(loc);
}

#define GET_ATTRIBUTE_float(attrib, matInfo, attrib_offset) read_material_float(matInfo, attrib_offset)
#define GET_ATTRIBUTE_vec4(attrib, matInfo, attrib_offset) read_material_vec4(matInfo, attrib_offset)
#define GET_ATTRIBUTE_vec2(attrib, matInfo, attrib_offset) read_material_vec2(matInfo, attrib_offset)
#define DECLARE_MATERIAL_TABLE_INFO MaterialInfo materialInfo = read_material_info(uint(gl_VertexID));
#define DECLARE_MATERIAL_TABLE_INFO_DEBUG(dbgColor) MaterialInfo materialInfo = read_material_info(uint(gl_VertexID)); dbgColor = materialInfo.colorDebug;

/////////////Copy to cpu END
#endif