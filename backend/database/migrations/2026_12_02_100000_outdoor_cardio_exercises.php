<?php

use App\Models\Exercise;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /** Cardio ao ar livre (o mais comum para registrar depois): corrida, caminhada e pedal. */
    private const NAMES = ['Corrida', 'Caminhada', 'Pedal (bicicleta)'];

    public function up(): void
    {
        foreach (self::NAMES as $name) {
            Exercise::firstOrCreate(['name' => $name, 'user_id' => null], ['muscle_group' => 'cardio']);
        }
    }

    public function down(): void
    {
        Exercise::whereNull('user_id')->whereIn('name', self::NAMES)->delete();
    }
};
