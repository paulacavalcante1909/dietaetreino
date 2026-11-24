<?php

namespace Database\Seeders;

use App\Models\Exercise;
use Illuminate\Database\Seeder;

/** Biblioteca padrão de exercícios (free-exercise-db, domínio público). Idempotente. */
class ExerciseSeeder extends Seeder
{
    public function run(): void
    {
        $map = require database_path('data/exercises.php');
        foreach ($map as $sourceId => [$name, $group]) {
            Exercise::updateOrCreate(
                ['source_id' => $sourceId],
                ['name' => $name, 'muscle_group' => $group, 'image' => '/exercises/'.$sourceId],
            );
        }
        $this->command?->info('Exercícios: '.count($map).' na biblioteca.');
    }
}
