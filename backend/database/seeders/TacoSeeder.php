<?php

namespace Database\Seeders;

use App\Models\Food;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Importa a Tabela TACO (4ª ed., NEPA/UNICAMP) — valores por 100 g.
 * Fonte do CSV: github.com/raulfdm/taco-api (MIT). Idempotente.
 */
class TacoSeeder extends Seeder
{
    /** Porções caseiras comuns: prefixo do nome TACO => [rótulo => gramas]. */
    private const PORTIONS = [
        'Ovo, de galinha, inteiro' => ['1 unidade' => 50],
        'Ovo, de galinha, clara' => ['1 clara' => 33],
        'Ovo, de galinha, gema' => ['1 gema' => 17],
        'Pão, trigo, francês' => ['1 unidade' => 50],
        'Pão, trigo, forma' => ['1 fatia' => 25],
        'Pão, de queijo' => ['1 unidade média' => 20],
        'Banana' => ['1 unidade média' => 86],
        'Maçã' => ['1 unidade média' => 130],
        'Laranja, pêra, crua' => ['1 unidade média' => 140],
        'Laranja, pêra, suco' => ['1 copo (200 ml)' => 200],
        'Mamão' => ['1 fatia média' => 150],
        'Leite, de vaca' => ['1 copo (200 ml)' => 200, '1 xícara (240 ml)' => 240],
        'Café, infusão' => ['1 xícara (100 ml)' => 100, '1 xícara pequena (50 ml)' => 50],
        'Iogurte' => ['1 pote (170 g)' => 170],
        'Arroz' => ['1 colher de servir' => 45, '1 escumadeira' => 90],
        'Feijão' => ['1 concha' => 140],
        'Aveia' => ['1 colher de sopa' => 15],
        'Açúcar' => ['1 colher de chá' => 5, '1 colher de sopa' => 15],
        'Azeite' => ['1 colher de sopa' => 13],
        'Óleo' => ['1 colher de sopa' => 13],
        'Manteiga' => ['1 colher de chá' => 5],
        'Margarina' => ['1 colher de chá' => 5],
        'Requeijão' => ['1 colher de sopa' => 30],
        'Queijo' => ['1 fatia' => 20],
        'Presunto' => ['1 fatia' => 15],
        'Biscoito' => ['1 unidade' => 8],
        'Tapioca' => ['1 unidade' => 80],
        'Batata, doce' => ['1 unidade média' => 150],
        'Frango, peito' => ['1 filé médio' => 120],
        'Carne, bovina' => ['1 bife médio' => 100],
        'Mel' => ['1 colher de sopa' => 20],
        'Doce, de leite' => ['1 colher de sopa' => 20],
        'Amendoim' => ['1 punhado' => 20],
        'Castanha' => ['1 unidade' => 4],
    ];

    /**
     * Linhas da TACO sem dados de energia/macros no CSV de origem.
     * Leites: valores do USDA FoodData Central (domínio público), sódio mantido da TACO.
     * Sem fonte confiável: não importa (evita registrar 0 kcal por engano).
     */
    private const FIXES = [
        '457' => ['kcal' => 34, 'carbs' => 5.0, 'protein' => 3.4, 'fat' => 0.1], // desnatado UHT (USDA 171269)
        '458' => ['kcal' => 61, 'carbs' => 4.8, 'protein' => 3.2, 'fat' => 3.3], // integral (USDA 171265)
    ];

    private const SKIP = ['450', '591']; // iogurte sabor abacaxi, coco verde

    public function run(): void
    {
        $h = fopen(database_path('data/taco.csv'), 'r');
        $head = fgetcsv($h, 0, ',', '"', '');

        DB::transaction(function () use ($h, $head) {
            $count = 0;
            while (($row = fgetcsv($h, 0, ',', '"', '')) !== false) {
                $r = array_combine($head, $row);
                if (in_array($r['taco_id'], self::SKIP, true)) {
                    Food::where('source', 'taco')->where('external_id', $r['taco_id'])->delete();

                    continue;
                }
                $r = array_merge($r, self::FIXES[$r['taco_id']] ?? []);

                $food = Food::updateOrCreate(
                    ['source' => 'taco', 'external_id' => $r['taco_id']],
                    [
                        'name' => $r['name'],
                        'category' => $r['category'],
                        'base_qty' => 100,
                        'base_unit' => 'g',
                        'kcal' => $r['kcal'],
                        'carbs' => $r['carbs'],
                        'protein' => $r['protein'],
                        'fat' => $r['fat'],
                        'fiber' => $r['fiber'],
                        'sodium' => $r['sodium'],
                    ],
                );

                // Atualiza porções por rótulo, sem apagar: diário e receitas referenciam portion_id
                foreach (self::PORTIONS as $prefix => $portions) {
                    if (str_starts_with($r['name'], $prefix)) {
                        foreach ($portions as $label => $qty) {
                            $food->portions()->updateOrCreate(['label' => $label], ['qty' => $qty]);
                        }
                        break;
                    }
                }
                $count++;
            }
            $this->command?->info("TACO: {$count} alimentos importados.");
        });

        fclose($h);
    }
}
