<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WaterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WaterController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'ml' => ['required', 'integer', 'min:1', 'max:5000'],
        ]);
        $log = $request->user()->waterLogs()->create($data);

        return response()->json(['water' => $log], 201);
    }

    public function destroy(Request $request, WaterLog $water): JsonResponse
    {
        abort_unless($water->user_id === $request->user()->id, 404);
        $water->delete();

        return response()->json(['ok' => true]);
    }
}
