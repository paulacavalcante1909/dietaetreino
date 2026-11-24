<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    // Sem WithoutModelEvents: Food e Exercise usam o evento `saving` para gerar search_name.
    public function run(): void
    {
        $this->call([TacoSeeder::class, ExerciseSeeder::class]);
    }
}
