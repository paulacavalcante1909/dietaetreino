<?php

namespace App\Services;

use App\Models\Food;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Integração com a Open Food Facts (dados abertos, ODbL).
 * Produtos encontrados são gravados como alimentos globais (source=off) e servem de cache.
 */
class OpenFoodFacts
{
    private const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/%s.json';

    private const SEARCH_URL = 'https://search.openfoodfacts.org/search';

    private const FIELDS = 'code,product_name,product_name_pt,brands,nutriments,serving_size,serving_quantity,quantity,nutrition_data_per';

    private function http()
    {
        return Http::withUserAgent('DietaETreino/1.0 (app PWA de nutricao)')->timeout(8)->retry(1, 300, throw: false);
    }

    /** Busca produto pelo código de barras. Retorna null se não existir ou não tiver dados nutricionais. */
    public function findByBarcode(string $ean): ?Food
    {
        try {
            $res = $this->http()->get(sprintf(self::PRODUCT_URL, $ean), ['fields' => self::FIELDS]);
        } catch (Throwable $e) {
            Log::warning('OFF indisponível', ['ean' => $ean, 'error' => $e->getMessage()]);

            return null;
        }

        $p = $res->json('product');
        if (! $res->ok() || ! $p) {
            return null;
        }

        return $this->store($ean, $p);
    }

    /** Busca por nome (apenas código, nome e marca). Resultados em cache por 1 dia. */
    public function search(string $query): array
    {
        $key = 'off-search:'.Food::normalize($query);

        return Cache::remember($key, now()->addDay(), function () use ($query) {
            try {
                $res = $this->http()->get(self::SEARCH_URL, [
                    'q' => $query,
                    'langs' => 'pt',
                    'page_size' => 30,
                    'fields' => 'code,product_name,brands',
                ]);
            } catch (Throwable) {
                return [];
            }
            if (! $res->ok()) {
                return [];
            }

            return collect($res->json('hits', []))
                ->filter(fn ($h) => ! empty($h['product_name']) && ! empty($h['code']))
                // Produtos brasileiros (GS1 789/790) primeiro
                ->sortBy(fn ($h) => preg_match('/^(789|790)/', $h['code']) ? 0 : 1)
                ->map(fn ($h) => [
                    'code' => $h['code'],
                    'name' => Str::limit(trim($h['product_name']), 185, ''),
                    'brand' => $this->brand($h['brands'] ?? null),
                ])
                ->values()
                ->all();
        });
    }

    private function store(string $ean, array $p): ?Food
    {
        $n = $p['nutriments'] ?? [];
        $kcal = $n['energy-kcal_100g'] ?? (isset($n['energy_100g']) ? $n['energy_100g'] / 4.184 : null);
        if ($kcal === null) {
            return null; // sem tabela nutricional: melhor a usuária cadastrar
        }

        // Sódio em mg: OFF usa gramas; se só houver sal, sódio = sal / 2,5
        $sodiumG = $n['sodium_100g'] ?? (isset($n['salt_100g']) ? $n['salt_100g'] / 2.5 : 0);
        $isLiquid = str_contains(strtolower(($p['quantity'] ?? '').' '.($p['nutrition_data_per'] ?? '')), 'ml');

        $name = trim($p['product_name_pt'] ?? '') ?: trim($p['product_name'] ?? '') ?: 'Produto '.$ean;

        $food = Food::updateOrCreate(
            ['source' => 'off', 'external_id' => $ean],
            [
                'ean' => $ean,
                'name' => Str::limit($name, 185, ''),
                'brand' => $this->brand($p['brands'] ?? null),
                'base_qty' => 100,
                'base_unit' => $isLiquid ? 'ml' : 'g',
                'kcal' => round((float) $kcal, 2),
                'carbs' => round((float) ($n['carbohydrates_100g'] ?? 0), 2),
                'protein' => round((float) ($n['proteins_100g'] ?? 0), 2),
                'fat' => round((float) ($n['fat_100g'] ?? 0), 2),
                'sodium' => round((float) $sodiumG * 1000, 2),
                'fiber' => isset($n['fiber_100g']) ? round((float) $n['fiber_100g'], 2) : null,
            ],
        );

        // Porção do rótulo (ex.: "30 g", "1 copo (200 ml)"). Atualiza por rótulo, sem apagar:
        // registros e receitas referenciam portion_id.
        $servingQty = (float) ($p['serving_quantity'] ?? 0);
        if ($servingQty > 0 && $servingQty < 5000) {
            $label = trim(preg_replace('/\s*\(.*\)$/', '', (string) ($p['serving_size'] ?? '')));
            $food->portions()->updateOrCreate(
                ['label' => Str::limit($label && ! is_numeric(substr($label, 0, 1)) ? $label : '1 porção', 55, '')],
                ['qty' => $servingQty],
            );
        }

        return $food;
    }

    /** "xx:shark-pro, Outra" → "Shark Pro" */
    private function brand(string|array|null $brands): ?string
    {
        $first = is_array($brands) ? ($brands[0] ?? null) : explode(',', (string) $brands)[0];
        $first = trim(preg_replace('/^[a-z]{2}:/', '', (string) $first));
        if ($first === '') {
            return null;
        }
        if (str_contains($first, '-') && ! str_contains($first, ' ')) {
            $first = Str::title(str_replace('-', ' ', $first));
        }

        return Str::limit($first, 115, '');
    }
}
