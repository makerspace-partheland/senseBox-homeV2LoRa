// based on https://github.com/dasdigidings/The_Things_Stack_v3-payload_functions/tree/main/senseboxhome and https://github.com/thesolarnomad/lora-serialization/tree/master

function decodeUplink(input) {
    'use strict';
    var TEMPSENSOR_ID = 'Temperatur',
        HUMISENSOR_ID = 'Luftfeuchte',
        PRESSURESENSOR_ID = 'Luftdruck',
        LUXSENSOR_ID = 'Beleuchtungsstaerke',
        UVSENSOR_ID = 'UV-Intensitaet',
        PM10_ID = 'PM10',
        PM25_ID = 'PM25',
        SOUNDLEVELMETER_ID = 'Lautstaerke';

    var bytesToInt = function (bytes) {
        var i = 0;
        for (var x = 0; x < bytes.length; x++) {
            i |= +(bytes[x] << (x * 8));
        }
        return i;
    };

    var uint8 = function (bytes) {
        if (bytes.length !== uint8.BYTES) {
            throw new Error('int must have exactly 1 byte');
        }
        return bytesToInt(bytes);
    };
    uint8.BYTES = 1;

    var uint16 = function (bytes) {
        if (bytes.length !== uint16.BYTES) {
            throw new Error('int must have exactly 2 bytes');
        }
        return bytesToInt(bytes);
    };
    uint16.BYTES = 2;

    var humidity = function (bytes) {
        if (bytes.length !== humidity.BYTES) {
            throw new Error('Humidity must have exactly 2 bytes');
        }
        var h = bytesToInt(bytes);
        return h / 1e2;
    };
    humidity.BYTES = 2;

    var decode = function (bytes, mask, names) {
        var maskLength = mask.reduce(function (prev, cur) {
            return prev + cur.BYTES;
        }, 0);
        if (bytes.length < maskLength) {
            throw new Error('Mask length is ' + maskLength + ' whereas input is ' + bytes.length);
        }
        names = names || [];
        var offset = 0;
        return mask
            .map(function (decodeFn) {
                var current = bytes.slice(offset, offset += decodeFn.BYTES);
                return decodeFn(current);
            })
            .reduce(function (prev, cur, idx) {
                prev[names[idx] || idx] = cur;
                return prev;
            }, {});
    };

    var json = {
        data: {},
        warnings: [],
        errors: []
    };

    try {
        json.data = decode(input.bytes,
            [
                uint16,
                humidity,
                uint16,
                uint8,
                uint16,
                uint8,
                uint16,
                uint16,
                uint16,
                uint16
            ],
            [
                TEMPSENSOR_ID,
                HUMISENSOR_ID,
                PRESSURESENSOR_ID,
                LUXSENSOR_ID + '_mod',
                LUXSENSOR_ID + '_times',
                UVSENSOR_ID + '_mod',
                UVSENSOR_ID + '_times',
                PM10_ID,
                PM25_ID,
                SOUNDLEVELMETER_ID
            ]);

        // temperature HDC1080
        json.data[TEMPSENSOR_ID] = parseFloat(((json.data[TEMPSENSOR_ID] / 771) - 18).toFixed(1));

        // humidity HDC1080
        json.data[HUMISENSOR_ID] = parseFloat(json.data[HUMISENSOR_ID].toFixed(1));

        // pressure DPS310 / BMP280
        if (json.data[PRESSURESENSOR_ID] !== '0') {
            json.data[PRESSURESENSOR_ID] = parseFloat(((json.data[PRESSURESENSOR_ID] / 81.9187) + 300).toFixed(1));
        } else {
            delete json.data[PRESSURESENSOR_ID];
        }

        // lux TSL45315
        json.data[LUXSENSOR_ID] = (json.data[LUXSENSOR_ID + '_times'] * 255) + json.data[LUXSENSOR_ID + '_mod'];
        delete json.data[LUXSENSOR_ID + '_times'];
        delete json.data[LUXSENSOR_ID + '_mod'];

        // uv VEML6070
        json.data[UVSENSOR_ID] = (json.data[UVSENSOR_ID + '_times'] * 255) + json.data[UVSENSOR_ID + '_mod'];
        delete json.data[UVSENSOR_ID + '_times'];
        delete json.data[UVSENSOR_ID + '_mod'];

        //particulate matter SDS 011
        json.data[PM10_ID] = parseFloat(((json.data[PM10_ID] / 10)).toFixed(1));
        json.data[PM25_ID] = parseFloat(((json.data[PM25_ID] / 10)).toFixed(1));

        //sound SDFRobot SEN0232
        json.data[SOUNDLEVELMETER_ID] = parseFloat(((json.data[SOUNDLEVELMETER_ID] / 10)).toFixed(1));

    } catch (e) {
        json = {
            data: {
                bytes: input.bytes
            },
            warnings: [],
            errors: [e]
        };
    }
    return json;
}